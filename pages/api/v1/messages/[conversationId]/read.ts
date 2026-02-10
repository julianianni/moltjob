import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'

interface ConversationAccess {
  conversation_id: string
}

async function verifyAccess(
  conversationId: string,
  userId: string,
  role: string
): Promise<ConversationAccess | null> {
  if (role === 'employer') {
    return queryOne<ConversationAccess>(
      `SELECT c.id as conversation_id
       FROM conversations c
       JOIN applications a ON a.id = c.application_id
       JOIN job_postings jp ON jp.id = a.job_posting_id
       JOIN employers e ON e.id = jp.employer_id
       WHERE c.id = $1 AND e.user_id = $2`,
      [conversationId, userId]
    )
  }

  return queryOne<ConversationAccess>(
    `SELECT c.id as conversation_id
     FROM conversations c
     JOIN applications a ON a.id = c.application_id
     JOIN job_seekers js ON js.id = a.job_seeker_id
     WHERE c.id = $1 AND js.user_id = $2`,
    [conversationId, userId]
  )
}

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { conversationId } = req.query

  const access = await verifyAccess(
    conversationId as string,
    req.user.userId,
    req.user.role
  )

  if (!access) {
    return res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' })
  }

  const { message_ids, all } = req.body

  if (all) {
    await query(
      'UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND read_at IS NULL',
      [conversationId]
    )
    return res.json({ message: 'All messages marked as read' })
  }

  if (message_ids && Array.isArray(message_ids) && message_ids.length > 0) {
    await query(
      'UPDATE messages SET read_at = NOW() WHERE id = ANY($1) AND conversation_id = $2 AND read_at IS NULL',
      [message_ids, conversationId]
    )
    return res.json({ message: `${message_ids.length} message(s) marked as read` })
  }

  return res.status(400).json({ error: 'Provide message_ids array or all: true', code: 'VALIDATION_ERROR' })
})
