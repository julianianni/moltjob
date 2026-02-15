import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query } from '@/lib/db'
import { completeOnboarding } from '@/lib/orchestrator'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId } = req.query

  try {
    const result = await completeOnboarding(sessionId as string)
    const completionResult = result as { agent_id: string }

    // Store the agent_id in agent_mappings
    if (completionResult.agent_id) {
      await query(
        `UPDATE agent_mappings
         SET agent_id = $1, agent_hosting = 'hosted', updated_at = NOW()
         WHERE user_id = $2 AND onboarding_session_id = $3`,
        [completionResult.agent_id, req.user.userId, sessionId]
      )
    }

    return res.json(result)
  } catch (error) {
    console.error('[onboarding] Failed to complete:', error)
    return res.status(502).json({ error: 'Failed to complete onboarding', code: 'ORCHESTRATOR_ERROR' })
  }
})
