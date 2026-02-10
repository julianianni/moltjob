import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { matchJobsForSeeker } from '@/lib/matching'
import type { JobPosting, JobSeeker } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20))
  const offset = (page - 1) * perPage

  // Build filters
  const conditions: string[] = ["jp.status = 'active'"]
  const params: unknown[] = []
  let paramIndex = 1

  if (req.query.remote_type) {
    conditions.push(`jp.remote_type = $${paramIndex}`)
    params.push(req.query.remote_type)
    paramIndex++
  }

  if (req.query.salary_min) {
    conditions.push(`jp.salary_max >= $${paramIndex}`)
    params.push(parseInt(req.query.salary_min as string))
    paramIndex++
  }

  if (req.query.skills) {
    const skills = (req.query.skills as string).split(',').map(s => s.trim())
    conditions.push(`jp.required_skills && $${paramIndex}`)
    params.push(skills)
    paramIndex++
  }

  const where = conditions.join(' AND ')

  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM job_postings jp WHERE ${where}`,
    params
  )
  const total = countResult?.count ?? 0

  const jobs = await query<JobPosting>(
    `SELECT jp.*, e.company_name
    FROM job_postings jp
    JOIN employers e ON e.id = jp.employer_id
    WHERE ${where}
    ORDER BY jp.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, perPage, offset]
  )

  // Optionally include match scores
  if (req.query.include_match_score === 'true' && req.user.role === 'job_seeker') {
    const seeker = await queryOne<JobSeeker>(
      'SELECT * FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )

    if (seeker) {
      const matched = matchJobsForSeeker(seeker, jobs)
      return res.json({
        data: matched.map(m => ({
          ...m.job_posting,
          match_score: m.score,
          breakdown: m.breakdown,
        })),
        pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      })
    }
  }

  return res.json({
    data: jobs,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  })
})
