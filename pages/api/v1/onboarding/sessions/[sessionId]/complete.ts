import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query } from '@/lib/db'
import { completeOnboarding, setAgentEnv } from '@/lib/orchestrator'
import { createApiKey } from '@/lib/apikeys'

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

    // Auto-generate API key for the agent
    let apiKeyPrefix: string | null = null
    if (completionResult.agent_id) {
      try {
        const { raw_key, record } = await createApiKey(req.user.userId, 'Agent API Key')
        apiKeyPrefix = record.key_prefix

        // Push the raw key to the orchestrator
        try {
          await setAgentEnv(completionResult.agent_id, { MOLTJOB_API_KEY: raw_key })
        } catch (envError) {
          console.error('[onboarding] Failed to push API key to orchestrator:', envError)
        }
      } catch (keyError) {
        console.error('[onboarding] Failed to create API key:', keyError)
      }
    }

    return res.json({
      ...(result as Record<string, unknown>),
      ...(apiKeyPrefix ? { api_key_prefix: apiKeyPrefix } : {}),
    })
  } catch (error) {
    console.error('[onboarding] Failed to complete:', error)
    return res.status(502).json({ error: 'Failed to complete onboarding', code: 'ORCHESTRATOR_ERROR' })
  }
})
