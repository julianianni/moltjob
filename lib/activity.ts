import { query } from './db'

export async function logActivity(params: {
  userId: string
  apiKeyId?: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await query(
    `INSERT INTO agent_activity_log (user_id, api_key_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      params.apiKeyId ?? null,
      params.action,
      params.resourceType ?? null,
      params.resourceId ?? null,
      JSON.stringify(params.metadata ?? {}),
    ]
  )
}
