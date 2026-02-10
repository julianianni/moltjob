import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import type { JobSeeker } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.user.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can access this endpoint', code: 'FORBIDDEN' })
  }

  if (req.method === 'GET') {
    const seeker = await queryOne<JobSeeker>(
      'SELECT * FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!seeker) {
      return res.status(404).json({ error: 'Profile not found. Create one with POST.', code: 'NOT_FOUND' })
    }
    return res.json(seeker)
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const {
      full_name, resume_text, skills, preferred_job_titles,
      preferred_locations, min_salary, max_salary,
      experience_years, remote_preference,
    } = req.body

    if (!full_name || !resume_text) {
      return res.status(400).json({ error: 'full_name and resume_text are required', code: 'VALIDATION_ERROR' })
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
      await logActivity({ userId: req.user.userId, apiKeyId: req.apiKeyId, action: 'update_profile', resourceType: 'profile', resourceId: updated.id })
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
    await logActivity({ userId: req.user.userId, apiKeyId: req.apiKeyId, action: 'create_profile', resourceType: 'profile', resourceId: seeker.id })
    return res.status(201).json(seeker)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
