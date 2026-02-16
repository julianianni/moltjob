import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { queryOne } from '@/lib/db'
import type { Application, JobSeeker } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  if (req.user.role === 'job_seeker') {
    const seeker = await queryOne<JobSeeker>(
      'SELECT id FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )

    const application = await queryOne<Application>(
      `SELECT a.*, jp.title as job_title, e.company_name, c.id as conversation_id
       FROM applications a
       JOIN job_postings jp ON jp.id = a.job_posting_id
       JOIN employers e ON e.id = jp.employer_id
       LEFT JOIN conversations c ON c.application_id = a.id
       WHERE a.id = $1 AND a.job_seeker_id = $2`,
      [id, seeker?.id]
    )

    if (!application) {
      return res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' })
    }

    return res.json(application)
  }

  return res.status(403).json({ error: 'Use /api/v1/employer/applications for employer access', code: 'FORBIDDEN' })
})
