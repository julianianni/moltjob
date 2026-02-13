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
      skill_weights, min_match_score,
      location, remote_type, salary_min, salary_max,
      experience_min, experience_max, status,
    } = req.body

    // Validate skill_weights
    if (skill_weights != null) {
      if (typeof skill_weights !== 'object' || Array.isArray(skill_weights)) {
        return res.status(400).json({ error: 'skill_weights must be an object mapping skill names to positive numbers', code: 'VALIDATION_ERROR' })
      }
      for (const [skill, weight] of Object.entries(skill_weights)) {
        if (typeof weight !== 'number' || weight <= 0) {
          return res.status(400).json({ error: `Invalid weight for skill "${skill}": must be a positive number`, code: 'VALIDATION_ERROR' })
        }
      }
      // Validate keys against the skills being set (or existing ones)
      let allSkills: Set<string>
      if (required_skills || nice_to_have_skills) {
        allSkills = new Set([...(required_skills || []), ...(nice_to_have_skills || [])])
      } else {
        const currentJob = await queryOne<JobPosting>(
          'SELECT required_skills, nice_to_have_skills FROM job_postings WHERE id = $1 AND employer_id = $2',
          [id, employer.id]
        )
        if (!currentJob) {
          return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' })
        }
        allSkills = new Set([...currentJob.required_skills, ...currentJob.nice_to_have_skills])
      }
      for (const skill of Object.keys(skill_weights)) {
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

    const [updated] = await query<JobPosting>(
      `UPDATE job_postings SET
        title = COALESCE($1, title), description = COALESCE($2, description),
        required_skills = COALESCE($3, required_skills), nice_to_have_skills = COALESCE($4, nice_to_have_skills),
        skill_weights = COALESCE($5, skill_weights), min_match_score = COALESCE($6, min_match_score),
        location = COALESCE($7, location), remote_type = COALESCE($8, remote_type),
        salary_min = COALESCE($9, salary_min), salary_max = COALESCE($10, salary_max),
        experience_min = COALESCE($11, experience_min), experience_max = COALESCE($12, experience_max),
        status = COALESCE($13, status), updated_at = NOW()
      WHERE id = $14 AND employer_id = $15 RETURNING *`,
      [title, description, required_skills, nice_to_have_skills, skill_weights, min_match_score, location, remote_type, salary_min, salary_max, experience_min, experience_max, status, id, employer.id]
    )

    if (!updated) {
      return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' })
    }
    return res.json(updated)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
