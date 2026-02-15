import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { createOnboardingSession } from '@/lib/orchestrator'
import type { AgentMapping } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { agent_type } = req.body

  if (!agent_type || !['seeker', 'employer'].includes(agent_type)) {
    return res.status(400).json({ error: 'agent_type must be "seeker" or "employer"', code: 'VALIDATION_ERROR' })
  }

  // Check if user already has an agent mapping
  const existing = await queryOne<AgentMapping>(
    'SELECT * FROM agent_mappings WHERE user_id = $1',
    [req.user.userId]
  )

  if (existing?.agent_id) {
    return res.status(409).json({ error: 'Agent already provisioned', code: 'ALREADY_EXISTS' })
  }

  try {
    const result = await createOnboardingSession(req.user.userId, agent_type, {
      name: req.user.email.split('@')[0],
      email: req.user.email,
    })

    const sessionResult = result as { session_id: string }

    // Upsert agent_mapping with onboarding_session_id
    if (existing) {
      await query(
        'UPDATE agent_mappings SET onboarding_session_id = $1, updated_at = NOW() WHERE user_id = $2',
        [sessionResult.session_id, req.user.userId]
      )
    } else {
      await query(
        `INSERT INTO agent_mappings (user_id, agent_id, agent_hosting, onboarding_session_id)
         VALUES ($1, '', 'hosted', $2)`,
        [req.user.userId, sessionResult.session_id]
      )
    }

    return res.status(201).json(result)
  } catch (error) {
    console.error('[onboarding] Failed to create session:', error)
    return res.status(502).json({ error: 'Failed to create onboarding session', code: 'ORCHESTRATOR_ERROR' })
  }
})
