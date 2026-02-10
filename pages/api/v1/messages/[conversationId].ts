import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import type { Message } from '@/lib/types'

interface ConversationAccess {
  conversation_id: string
  job_seeker_id: string
  employer_id: string
}

async function verifyAccess(
  conversationId: string,
  userId: string,
  role: string
): Promise<ConversationAccess | null> {
  if (role === 'employer') {
    return queryOne<ConversationAccess>(
      `SELECT c.id as conversation_id, a.job_seeker_id, jp.employer_id
       FROM conversations c
       JOIN applications a ON a.id = c.application_id
       JOIN job_postings jp ON jp.id = a.job_posting_id
       JOIN employers e ON e.id = jp.employer_id
       WHERE c.id = $1 AND e.user_id = $2`,
      [conversationId, userId]
    )
  }

  return queryOne<ConversationAccess>(
    `SELECT c.id as conversation_id, a.job_seeker_id, jp.employer_id
     FROM conversations c
     JOIN applications a ON a.id = c.application_id
     JOIN job_seekers js ON js.id = a.job_seeker_id
     WHERE c.id = $1 AND js.user_id = $2`,
    [conversationId, userId]
  )
}

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  const { conversationId } = req.query

  const access = await verifyAccess(
    conversationId as string,
    req.user.userId,
    req.user.role
  )

  if (!access) {
    return res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' })
  }

  if (req.method === 'GET') {
    const messages = await query<Message>(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    )
    return res.json(messages)
  }

  if (req.method === 'POST') {
    const { content } = req.body
    if (!content) {
      return res.status(400).json({ error: 'Message content is required', code: 'VALIDATION_ERROR' })
    }

    const senderType = req.user.role === 'job_seeker' ? 'agent' : 'employer'

    const [message] = await query<Message>(
      `INSERT INTO messages (conversation_id, sender_type, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, senderType, content]
    )

    await logActivity({
      userId: req.user.userId,
      apiKeyId: req.apiKeyId,
      action: 'send_message',
      resourceType: 'message',
      resourceId: message.id,
      metadata: { conversation_id: conversationId, sender_type: senderType },
    })

    return res.status(201).json(message)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
