import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/apikeys'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const { name } = req.body
    const { raw_key, record } = await createApiKey(
      req.user.userId,
      name || 'Default'
    )

    return res.status(201).json({
      api_key: raw_key,
      id: record.id,
      key_prefix: record.key_prefix,
      name: record.name,
      created_at: record.created_at,
      warning: 'Store this key securely. It will not be shown again.',
    })
  }

  if (req.method === 'GET') {
    const keys = await listApiKeys(req.user.userId)
    return res.json(keys)
  }

  if (req.method === 'DELETE') {
    const { key_id } = req.body
    if (!key_id) {
      return res.status(400).json({ error: 'key_id is required' })
    }
    const revoked = await revokeApiKey(key_id, req.user.userId)
    if (!revoked) {
      return res.status(404).json({ error: 'API key not found' })
    }
    return res.json({ message: 'API key revoked' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
