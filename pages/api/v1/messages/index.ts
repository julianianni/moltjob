import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import type { Message, JobSeeker, Employer } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const unreadOnly = req.query.unread_only === 'true'
  const since = req.query.since as string | undefined
  const applicationId = req.query.application_id as string | undefined

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Role-based access
  if (req.user.role === 'job_seeker') {
    const seeker = await queryOne<JobSeeker>(
      'SELECT id FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!seeker) return res.json({ messages: [] })

    conditions.push(`a.job_seeker_id = $${paramIndex}`)
    params.push(seeker.id)
    paramIndex++

    if (unreadOnly) {
      conditions.push('m.read_at IS NULL')
      conditions.push("m.sender_type = 'employer'")
    }
  } else {
    const employer = await queryOne<Employer>(
      'SELECT id FROM employers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!employer) return res.json({ messages: [] })

    conditions.push(`jp.employer_id = $${paramIndex}`)
    params.push(employer.id)
    paramIndex++

    if (unreadOnly) {
      conditions.push('m.read_at IS NULL')
      conditions.push("m.sender_type = 'agent'")
    }
  }

  if (since) {
    conditions.push(`m.created_at > $${paramIndex}`)
    params.push(since)
    paramIndex++
  }

  if (applicationId) {
    conditions.push(`a.id = $${paramIndex}`)
    params.push(applicationId)
    paramIndex++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const messages = await query<Message>(
    `SELECT m.*, c.application_id, jp.title as job_title, e.company_name
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     JOIN applications a ON a.id = c.application_id
     JOIN job_postings jp ON jp.id = a.job_posting_id
     JOIN employers e ON e.id = jp.employer_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT 50`,
    params
  )

  await logActivity({
    userId: req.user.userId,
    apiKeyId: req.apiKeyId,
    action: 'check_messages',
    metadata: { unread_only: unreadOnly, count: messages.length },
  })

  return res.json({ messages })
})
