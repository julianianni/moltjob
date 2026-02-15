import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { sendOnboardingMessage } from '@/lib/orchestrator'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId } = req.query
  const { content } = req.body

  if (!content) {
    return res.status(400).json({ error: 'content is required', code: 'VALIDATION_ERROR' })
  }

  try {
    const result = await sendOnboardingMessage(sessionId as string, content)
    return res.json(result)
  } catch (error) {
    console.error('[onboarding] Failed to send message:', error)
    return res.status(502).json({ error: 'Failed to send message', code: 'ORCHESTRATOR_ERROR' })
  }
})
