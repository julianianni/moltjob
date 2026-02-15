import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { notifyAgent } from '@/lib/orchestrator'
import type { Application, Employer } from '@/lib/types'

const VALID_STATUSES = ['pending', 'reviewing', 'shortlisted', 'interview_scheduled', 'rejected', 'accepted']

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Only employers can update application status', code: 'FORBIDDEN' })
  }

  const { id } = req.query
  const { status } = req.body

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, code: 'VALIDATION_ERROR' })
  }

  const employer = await queryOne<Employer>(
    'SELECT id FROM employers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!employer) {
    return res.status(400).json({ error: 'Employer profile not found', code: 'VALIDATION_ERROR' })
  }

  const application = await queryOne<Application>(
    `SELECT a.* FROM applications a
     JOIN job_postings jp ON jp.id = a.job_posting_id
     WHERE a.id = $1 AND jp.employer_id = $2`,
    [id, employer.id]
  )

  if (!application) {
    return res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' })
  }

  const [updated] = await query<Application>(
    'UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  )

  await logActivity({
    userId: req.user.userId,
    apiKeyId: req.apiKeyId,
    action: 'update_application_status',
    resourceType: 'application',
    resourceId: updated.id,
    metadata: { from: application.status, to: status },
  })

  // Fire-and-forget webhook to the seeker
  const seekerInfo = await queryOne<{ user_id: string; job_title: string; company_name: string }>(
    `SELECT js.user_id, jp.title as job_title, e.company_name
     FROM applications a
     JOIN job_seekers js ON js.id = a.job_seeker_id
     JOIN job_postings jp ON jp.id = a.job_posting_id
     JOIN employers e ON e.id = jp.employer_id
     WHERE a.id = $1`,
    [id]
  )
  if (seekerInfo) {
    void notifyAgent(seekerInfo.user_id, 'status_change', {
      application_id: updated.id,
      job_posting_id: updated.job_posting_id,
      job_title: seekerInfo.job_title,
      company_name: seekerInfo.company_name,
      seeker_user_id: seekerInfo.user_id,
      employer_user_id: req.user.userId,
      old_status: application.status,
      new_status: status,
      changed_at: new Date().toISOString(),
    })
  }

  return res.json(updated)
})
