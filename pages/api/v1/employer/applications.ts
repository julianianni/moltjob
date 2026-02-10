import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { Application, Employer } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Only employers can access this endpoint', code: 'FORBIDDEN' })
  }

  const employer = await queryOne<Employer>(
    'SELECT id FROM employers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!employer) return res.json({ data: [] })

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20))
  const offset = (page - 1) * perPage
  const sortBy = req.query.sort_by === 'match_score' ? 'a.match_score DESC' : 'a.created_at DESC'

  const conditions: string[] = ['jp.employer_id = $1']
  const params: unknown[] = [employer.id]
  let paramIndex = 2

  if (req.query.job_id) {
    conditions.push(`jp.id = $${paramIndex}`)
    params.push(req.query.job_id)
    paramIndex++
  }

  if (req.query.status) {
    conditions.push(`a.status = $${paramIndex}`)
    params.push(req.query.status)
    paramIndex++
  }

  const where = conditions.join(' AND ')

  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM applications a JOIN job_postings jp ON jp.id = a.job_posting_id WHERE ${where}`,
    params
  )
  const total = countResult?.count ?? 0

  const applications = await query<Application>(
    `SELECT a.*, jp.title as job_title, js.full_name as seeker_name
     FROM applications a
     JOIN job_postings jp ON jp.id = a.job_posting_id
     JOIN job_seekers js ON js.id = a.job_seeker_id
     WHERE ${where}
     ORDER BY ${sortBy}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, perPage, offset]
  )

  return res.json({
    data: applications,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  })
})
