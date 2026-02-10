import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { JobPosting, Employer } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  const { id } = req.query

  if (req.method === 'GET') {
    const job = await queryOne<JobPosting>(
      `SELECT jp.*, e.company_name
      FROM job_postings jp
      JOIN employers e ON e.id = jp.employer_id
      WHERE jp.id = $1`,
      [id]
    )
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    return res.json(job)
  }

  if (req.method === 'PUT') {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ error: 'Only employers can update jobs' })
    }

    const employer = await queryOne<Employer>(
      'SELECT id FROM employers WHERE user_id = $1',
      [req.user.userId]
    )

    const job = await queryOne<JobPosting>(
      'SELECT * FROM job_postings WHERE id = $1 AND employer_id = $2',
      [id, employer?.id]
    )

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not authorized' })
    }

    const {
      title, description, required_skills, nice_to_have_skills,
      location, remote_type, salary_min, salary_max,
      experience_min, experience_max, status,
    } = req.body

    const [updated] = await query<JobPosting>(
      `UPDATE job_postings SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        required_skills = COALESCE($3, required_skills),
        nice_to_have_skills = COALESCE($4, nice_to_have_skills),
        location = COALESCE($5, location),
        remote_type = COALESCE($6, remote_type),
        salary_min = COALESCE($7, salary_min),
        salary_max = COALESCE($8, salary_max),
        experience_min = COALESCE($9, experience_min),
        experience_max = COALESCE($10, experience_max),
        status = COALESCE($11, status),
        updated_at = NOW()
      WHERE id = $12 RETURNING *`,
      [
        title, description, required_skills, nice_to_have_skills,
        location, remote_type, salary_min, salary_max,
        experience_min, experience_max, status, id,
      ]
    )
    return res.json(updated)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
