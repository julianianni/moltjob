import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { Application, Employer } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Only employers can update application status' })
  }

  const { id } = req.query
  const { status } = req.body

  const validStatuses = ['pending', 'reviewing', 'shortlisted', 'interview_scheduled', 'rejected', 'accepted']
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const employer = await queryOne<Employer>(
    'SELECT id FROM employers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!employer) {
    return res.status(400).json({ error: 'Employer profile not found' })
  }

  // Verify the application belongs to a job posted by this employer
  const application = await queryOne<Application>(
    `SELECT a.* FROM applications a
    JOIN job_postings jp ON jp.id = a.job_posting_id
    WHERE a.id = $1 AND jp.employer_id = $2`,
    [id, employer.id]
  )

  if (!application) {
    return res.status(404).json({ error: 'Application not found' })
  }

  const [updated] = await query<Application>(
    'UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  )

  return res.json(updated)
})
