import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { notifyAgent } from '@/lib/orchestrator'
import type { Message } from '@/lib/types'

interface ConversationAccess {
  conversation_id: string
  application_id: string
  job_seeker_id: string
  employer_id: string
  seeker_user_id: string
  employer_user_id: string
  job_title: string
  company_name: string
}

async function verifyAccess(
  conversationId: string,
  userId: string,
  role: string
): Promise<ConversationAccess | null> {
  if (role === 'employer') {
    return queryOne<ConversationAccess>(
      `SELECT c.id as conversation_id, c.application_id, a.job_seeker_id, jp.employer_id,
              js.user_id as seeker_user_id, e.user_id as employer_user_id,
              jp.title as job_title, e.company_name
       FROM conversations c
       JOIN applications a ON a.id = c.application_id
       JOIN job_postings jp ON jp.id = a.job_posting_id
       JOIN employers e ON e.id = jp.employer_id
       JOIN job_seekers js ON js.id = a.job_seeker_id
       WHERE c.id = $1 AND e.user_id = $2`,
      [conversationId, userId]
    )
  }

  return queryOne<ConversationAccess>(
    `SELECT c.id as conversation_id, c.application_id, a.job_seeker_id, jp.employer_id,
            js.user_id as seeker_user_id, e.user_id as employer_user_id,
            jp.title as job_title, e.company_name
     FROM conversations c
     JOIN applications a ON a.id = c.application_id
     JOIN job_postings jp ON jp.id = a.job_posting_id
     JOIN employers e ON e.id = jp.employer_id
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

    // Fire-and-forget webhook to the recipient
    const recipientUserId = req.user.role === 'job_seeker'
      ? access.employer_user_id
      : access.seeker_user_id
    void notifyAgent(recipientUserId, 'new_message', {
      message_id: message.id,
      conversation_id: conversationId as string,
      application_id: access.application_id,
      sender_user_id: req.user.userId,
      sender_type: senderType,
      recipient_user_id: recipientUserId,
      content,
      job_title: access.job_title,
      company_name: access.company_name,
      created_at: message.created_at,
    })

    return res.status(201).json(message)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
