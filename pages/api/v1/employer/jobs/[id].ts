import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { JobPosting, Employer } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Only employers can access this endpoint', code: 'FORBIDDEN' })
  }

  const employer = await queryOne<Employer>(
    'SELECT id FROM employers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!employer) {
    return res.status(400).json({ error: 'Employer profile not found', code: 'VALIDATION_ERROR' })
  }

  const { id } = req.query

  if (req.method === 'GET') {
    const job = await queryOne<JobPosting & { application_count: number }>(
      `SELECT jp.*, (SELECT COUNT(*)::int FROM applications WHERE job_posting_id = jp.id) as application_count
       FROM job_postings jp
       WHERE jp.id = $1 AND jp.employer_id = $2`,
      [id, employer.id]
    )
    if (!job) {
      return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' })
    }
    return res.json(job)
  }

  if (req.method === 'PUT') {
    const {
      title, description, required_skills, nice_to_have_skills,
      location, remote_type, salary_min, salary_max,
      experience_min, experience_max, status,
    } = req.body

    const [updated] = await query<JobPosting>(
      `UPDATE job_postings SET
        title = COALESCE($1, title), description = COALESCE($2, description),
        required_skills = COALESCE($3, required_skills), nice_to_have_skills = COALESCE($4, nice_to_have_skills),
        location = COALESCE($5, location), remote_type = COALESCE($6, remote_type),
        salary_min = COALESCE($7, salary_min), salary_max = COALESCE($8, salary_max),
        experience_min = COALESCE($9, experience_min), experience_max = COALESCE($10, experience_max),
        status = COALESCE($11, status), updated_at = NOW()
      WHERE id = $12 AND employer_id = $13 RETURNING *`,
      [title, description, required_skills, nice_to_have_skills, location, remote_type, salary_min, salary_max, experience_min, experience_max, status, id, employer.id]
    )

    if (!updated) {
      return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' })
    }
    return res.json(updated)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
