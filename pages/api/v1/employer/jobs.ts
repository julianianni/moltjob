import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
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
    return res.status(400).json({ error: 'Create your employer profile first', code: 'VALIDATION_ERROR' })
  }

  if (req.method === 'GET') {
    const jobs = await query<JobPosting>(
      `SELECT * FROM job_postings WHERE employer_id = $1 ORDER BY created_at DESC`,
      [employer.id]
    )
    return res.json({ data: jobs })
  }

  if (req.method === 'POST') {
    const {
      title, description, required_skills, nice_to_have_skills,
      skill_weights, min_match_score,
      location, remote_type, salary_min, salary_max,
      experience_min, experience_max,
    } = req.body

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required', code: 'VALIDATION_ERROR' })
    }

    // Validate skill_weights
    if (skill_weights != null) {
      if (typeof skill_weights !== 'object' || Array.isArray(skill_weights)) {
        return res.status(400).json({ error: 'skill_weights must be an object mapping skill names to positive numbers', code: 'VALIDATION_ERROR' })
      }
      const allSkills = new Set([...(required_skills || []), ...(nice_to_have_skills || [])])
      for (const [skill, weight] of Object.entries(skill_weights)) {
        if (typeof weight !== 'number' || weight <= 0) {
          return res.status(400).json({ error: `Invalid weight for skill "${skill}": must be a positive number`, code: 'VALIDATION_ERROR' })
        }
        if (!allSkills.has(skill)) {
          return res.status(400).json({ error: `Skill "${skill}" in skill_weights not found in required_skills or nice_to_have_skills`, code: 'VALIDATION_ERROR' })
        }
      }
    }

    // Validate min_match_score
    if (min_match_score != null) {
      if (typeof min_match_score !== 'number' || min_match_score < 0 || min_match_score > 100) {
        return res.status(400).json({ error: 'min_match_score must be a number between 0 and 100', code: 'VALIDATION_ERROR' })
      }
    }

    const [job] = await query<JobPosting>(
      `INSERT INTO job_postings (
        employer_id, title, description, required_skills, nice_to_have_skills,
        skill_weights, min_match_score,
        location, remote_type, salary_min, salary_max, experience_min, experience_max
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        employer.id, title, description, required_skills || [],
        nice_to_have_skills || [], skill_weights ?? null, min_match_score ?? null,
        location, remote_type || 'onsite',
        salary_min, salary_max, experience_min || 0, experience_max,
      ]
    )

    await logActivity({ userId: req.user.userId, apiKeyId: req.apiKeyId, action: 'post_job', resourceType: 'job_posting', resourceId: job.id, metadata: { title } })
    return res.status(201).json(job)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
