import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query } from '@/lib/db'
import { getOnboardingSession, cancelOnboarding } from '@/lib/orchestrator'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  const { sessionId } = req.query

  if (req.method === 'GET') {
    try {
      const result = await getOnboardingSession(sessionId as string)
      return res.json(result)
    } catch (error) {
      console.error('[onboarding] Failed to get session:', error)
      return res.status(502).json({ error: 'Failed to get onboarding session', code: 'ORCHESTRATOR_ERROR' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      await cancelOnboarding(sessionId as string)
      await query(
        'DELETE FROM agent_mappings WHERE user_id = $1 AND onboarding_session_id = $2',
        [req.user.userId, sessionId]
      )
      return res.json({ status: 'cancelled' })
    } catch (error) {
      console.error('[onboarding] Failed to cancel session:', error)
      return res.status(502).json({ error: 'Failed to cancel onboarding session', code: 'ORCHESTRATOR_ERROR' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
