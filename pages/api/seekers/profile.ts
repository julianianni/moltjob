import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { JobSeeker } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.user.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can access this endpoint' })
  }

  if (req.method === 'POST') {
    const {
      full_name,
      resume_text,
      skills,
      preferred_job_titles,
      preferred_locations,
      min_salary,
      max_salary,
      experience_years,
      remote_preference,
    } = req.body

    if (!full_name || !resume_text) {
      return res.status(400).json({ error: 'Name and resume are required' })
    }

    const existing = await queryOne<JobSeeker>(
      'SELECT id FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )

    if (existing) {
      const [updated] = await query<JobSeeker>(
        `UPDATE job_seekers SET
          full_name = $1, resume_text = $2, skills = $3,
          preferred_job_titles = $4, preferred_locations = $5,
          min_salary = $6, max_salary = $7, experience_years = $8,
          remote_preference = $9, updated_at = NOW()
        WHERE user_id = $10 RETURNING *`,
        [
          full_name, resume_text, skills || [],
          preferred_job_titles || [], preferred_locations || [],
          min_salary, max_salary, experience_years || 0,
          remote_preference || 'any', req.user.userId,
        ]
      )
      return res.json(updated)
    }

    const [seeker] = await query<JobSeeker>(
      `INSERT INTO job_seekers (
        user_id, full_name, resume_text, skills,
        preferred_job_titles, preferred_locations,
        min_salary, max_salary, experience_years, remote_preference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.user.userId, full_name, resume_text, skills || [],
        preferred_job_titles || [], preferred_locations || [],
        min_salary, max_salary, experience_years || 0,
        remote_preference || 'any',
      ]
    )
    return res.status(201).json(seeker)
  }

  if (req.method === 'GET') {
    const seeker = await queryOne<JobSeeker>(
      'SELECT * FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!seeker) {
      return res.status(404).json({ error: 'Profile not found' })
    }
    return res.json(seeker)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
