import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { ActivityLogEntry } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20))
  const offset = (page - 1) * perPage

  const countResult = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int as count FROM agent_activity_log WHERE user_id = $1',
    [req.user.userId]
  )
  const total = countResult?.count ?? 0

  const entries = await query<ActivityLogEntry>(
    `SELECT * FROM agent_activity_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.userId, perPage, offset]
  )

  return res.json({
    data: entries,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  })
})
