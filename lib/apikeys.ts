import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { query, queryOne } from './db'

export interface ApiKeyRow {
  id: string
  user_id: string
  key_hash: string
  key_prefix: string
  name: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export async function createApiKey(
  userId: string,
  name: string
): Promise<{ raw_key: string; record: Omit<ApiKeyRow, 'key_hash'> }> {
  const randomPart = crypto.randomBytes(16).toString('hex')
  const rawKey = `aj_live_${randomPart}`
  const keyPrefix = `aj_live_${randomPart.slice(0, 8)}`
  const keyHash = await bcrypt.hash(rawKey, 10)

  const [record] = await query<ApiKeyRow>(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, key_prefix, name, scopes, last_used_at, expires_at, revoked_at, created_at`,
    [userId, keyHash, keyPrefix, name]
  )

  return { raw_key: rawKey, record }
}

export async function validateApiKey(
  rawKey: string
): Promise<{ userId: string; email: string; role: string; apiKeyId: string } | null> {
  const prefixMatch = rawKey.match(/^aj_live_(\w{8})/)
  if (!prefixMatch) return null

  const prefix = `aj_live_${prefixMatch[1]}`

  const candidates = await query<ApiKeyRow & { email: string; role: string }>(
    `SELECT ak.*, u.email, u.role FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key_prefix = $1 AND ak.revoked_at IS NULL
     AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
    [prefix]
  )

  for (const candidate of candidates) {
    const valid = await bcrypt.compare(rawKey, candidate.key_hash)
    if (valid) {
      // Fire and forget: update last_used_at
      query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [candidate.id]).catch(() => {})
      return {
        userId: candidate.user_id,
        email: candidate.email,
        role: candidate.role,
        apiKeyId: candidate.id,
      }
    }
  }

  return null
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const result = await query(
    'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id',
    [keyId, userId]
  )
  return result.length > 0
}

export async function listApiKeys(userId: string) {
  return query<Omit<ApiKeyRow, 'key_hash'>>(
    `SELECT id, user_id, key_prefix, name, scopes, last_used_at, expires_at, revoked_at, created_at
     FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )
}
