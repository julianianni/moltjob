import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { JobPosting, Employer } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    const jobs = await query<JobPosting>(
      `SELECT jp.*, e.company_name
      FROM job_postings jp
      JOIN employers e ON e.id = jp.employer_id
      WHERE jp.status = 'active'
      ORDER BY jp.created_at DESC`
    )
    return res.json(jobs)
  }

  if (req.method === 'POST') {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ error: 'Only employers can post jobs' })
    }

    const employer = await queryOne<Employer>(
      'SELECT id FROM employers WHERE user_id = $1',
      [req.user.userId]
    )

    if (!employer) {
      return res.status(400).json({ error: 'Complete your employer profile first' })
    }

    const {
      title, description, required_skills, nice_to_have_skills,
      location, remote_type, salary_min, salary_max,
      experience_min, experience_max,
    } = req.body

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' })
    }

    const [job] = await query<JobPosting>(
      `INSERT INTO job_postings (
        employer_id, title, description, required_skills, nice_to_have_skills,
        location, remote_type, salary_min, salary_max, experience_min, experience_max
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        employer.id, title, description, required_skills || [],
        nice_to_have_skills || [], location, remote_type || 'onsite',
        salary_min, salary_max, experience_min || 0, experience_max,
      ]
    )
    return res.status(201).json(job)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
