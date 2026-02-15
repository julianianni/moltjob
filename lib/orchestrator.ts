import { GoogleAuth } from 'google-auth-library'
import { queryOne } from './db'
import type { AgentMapping } from './types'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || ''
const GCP_KEY_JSON = process.env.GCP_SERVICE_ACCOUNT_KEY || ''

let authClient: Awaited<ReturnType<GoogleAuth['getIdTokenClient']>> | null = null

async function getClient() {
  if (authClient) return authClient

  if (!GCP_KEY_JSON || !ORCHESTRATOR_URL) {
    return null
  }

  const credentials = JSON.parse(GCP_KEY_JSON)
  const auth = new GoogleAuth({ credentials })
  authClient = await auth.getIdTokenClient(ORCHESTRATOR_URL)
  return authClient
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Wake Agent (webhook delivery with retry) ---

export async function wakeAgent(
  agentId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const client = await getClient()
  if (!client) {
    console.warn('[orchestrator] No GCP credentials configured, skipping webhook')
    return false
  }

  const url = `${ORCHESTRATOR_URL}/agents/${agentId}/wake`
  const body = { event_type: eventType, payload }
  const maxRetries = 2

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.request({ url, method: 'POST', data: body })
      const status = response.status

      if (status === 202) {
        return true
      }

      if (status === 404 || status === 410) {
        console.error(`[orchestrator] Agent ${agentId} not found or deleted (${status})`)
        return false
      }

      if (status === 503 && attempt < maxRetries) {
        await sleep(30000)
        continue
      }

      if (status >= 500 && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 5000)
        continue
      }

      console.error(`[orchestrator] Unexpected status ${status} for agent ${agentId}`)
      return false
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 5000)
        continue
      }
      console.error(`[orchestrator] Failed to wake agent ${agentId} after ${maxRetries} retries:`, error)
      return false
    }
  }

  return false
}

// --- Notify Agent (lookup mapping + wake) ---

export async function notifyAgent(
  recipientUserId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const mapping = await queryOne<AgentMapping>(
      "SELECT * FROM agent_mappings WHERE user_id = $1 AND agent_hosting = 'hosted'",
      [recipientUserId]
    )

    if (!mapping) return

    await wakeAgent(mapping.agent_id, eventType, payload)
  } catch (error) {
    console.error(`[orchestrator] notifyAgent error for user ${recipientUserId}:`, error)
  }
}

// --- Onboarding Proxy Functions ---

async function orchestratorRequest(path: string, method: string, data?: unknown) {
  const client = await getClient()
  if (!client) {
    throw new Error('Orchestrator not configured')
  }

  const response = await client.request({
    url: `${ORCHESTRATOR_URL}${path}`,
    method,
    data,
  })

  return response.data
}

export async function createOnboardingSession(
  userId: string,
  agentType: 'seeker' | 'employer',
  initialContext: { name: string; email: string }
) {
  return orchestratorRequest('/onboarding/sessions', 'POST', {
    user_id: userId,
    agent_type: agentType,
    initial_context: initialContext,
  })
}

export async function sendOnboardingMessage(sessionId: string, content: string) {
  return orchestratorRequest(`/onboarding/sessions/${sessionId}/messages`, 'POST', { content })
}

export async function getOnboardingSession(sessionId: string) {
  return orchestratorRequest(`/onboarding/sessions/${sessionId}`, 'GET')
}

export async function completeOnboarding(sessionId: string) {
  return orchestratorRequest(`/onboarding/sessions/${sessionId}/complete`, 'POST')
}

export async function cancelOnboarding(sessionId: string) {
  return orchestratorRequest(`/onboarding/sessions/${sessionId}`, 'DELETE')
}
