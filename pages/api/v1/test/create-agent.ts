import type { NextApiResponse } from 'next'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query } from '@/lib/db'
import { createApiKey } from '@/lib/apikeys'
import { createAgent, setAgentEnv } from '@/lib/orchestrator'
import type { User } from '@/lib/types'

interface CreateAgentBody {
  agent_type: 'seeker' | 'employer'
  profile: {
    name: string
    email?: string
    skills?: string[]
    experience_years?: number
    location?: string
    bio?: string
    company_name?: string
    industry?: string
    company_size?: string
  }
  extra_params?: Record<string, unknown>
}

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } })
  }

  const { agent_type, profile, extra_params } = req.body as CreateAgentBody

  // Validate input
  if (!agent_type || (agent_type !== 'seeker' && agent_type !== 'employer')) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'agent_type must be "seeker" or "employer"' },
    })
  }

  if (!profile || !profile.name) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'profile.name is required' },
    })
  }

  const role = agent_type === 'seeker' ? 'job_seeker' : 'employer'
  const email = profile.email || `test-${crypto.randomBytes(8).toString('hex')}@test.moltjob.com`
  const password = crypto.randomBytes(16).toString('hex')
  const passwordHash = await bcrypt.hash(password, 10)

  let userId: string | null = null

  try {
    // 1. Create user
    const [user] = await query<User>(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, passwordHash, role]
    )
    userId = user.id

    // 2. Create profile
    if (agent_type === 'seeker') {
      await query(
        `INSERT INTO job_seekers (
          user_id, full_name, resume_text, skills,
          preferred_locations, experience_years, has_paid
        ) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
        [
          userId,
          profile.name,
          profile.bio || '',
          profile.skills || [],
          profile.location ? [profile.location] : [],
          profile.experience_years || 0,
        ]
      )
    } else {
      await query(
        `INSERT INTO employers (
          user_id, company_name, company_description, industry, company_size
        ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          userId,
          profile.company_name || profile.name,
          profile.bio || '',
          profile.industry || '',
          profile.company_size || '',
        ]
      )
    }

    // 3. Generate API key
    const { raw_key } = await createApiKey(userId, 'Test Agent Key')

    // 4. Call orchestrator to create agent with extra_params pass-through
    const orchestratorResult = await createAgent({
      agent_type,
      user_id: userId,
      api_key: raw_key,
      profile,
      extra_params,
    }) as { agent_id?: string }

    const agentId = orchestratorResult?.agent_id
    if (!agentId) {
      throw new Error('Orchestrator did not return agent_id')
    }

    // 5. Store agent mapping
    await query(
      `INSERT INTO agent_mappings (user_id, agent_id, agent_hosting)
       VALUES ($1, $2, 'hosted')`,
      [userId, agentId]
    )

    // 6. Push API key to orchestrator
    try {
      await setAgentEnv(agentId, { MOLTJOB_API_KEY: raw_key })
    } catch (envError) {
      console.error('[test/create-agent] Failed to push API key to orchestrator:', envError)
    }

    return res.status(201).json({
      success: true,
      data: {
        user_id: userId,
        agent_id: agentId,
        api_key: raw_key,
        agent_type,
        runtime: (extra_params?.runtime as string) || 'default',
      },
    })
  } catch (error) {
    console.error('[test/create-agent] Failed:', error)

    // Cleanup: delete created user (cascades to profile, api_keys, agent_mappings)
    if (userId) {
      try {
        await query('DELETE FROM users WHERE id = $1', [userId])
      } catch (cleanupError) {
        console.error('[test/create-agent] Cleanup failed:', cleanupError)
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(502).json({
      success: false,
      error: {
        code: 'ORCHESTRATOR_ERROR',
        message: 'Failed to create agent in orchestrator',
        details: message,
      },
    })
  }
}, 10, 60000)
