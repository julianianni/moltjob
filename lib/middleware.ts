import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { validateApiKey } from './apikeys'
import { checkRateLimit } from './ratelimit'
import type { AuthPayload } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload
}

export interface AuthenticatedRequest extends NextApiRequest {
  user: AuthPayload
  apiKeyId?: string
  authMethod: 'jwt' | 'api_key'
}

type AuthHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<void>

export function withAuth(handler: AuthHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header', code: 'UNAUTHORIZED' })
    }

    const token = authHeader.slice(7)
    const authed = req as AuthenticatedRequest

    // API key auth
    if (token.startsWith('aj_')) {
      const result = await validateApiKey(token)
      if (!result) {
        return res.status(401).json({ error: 'Invalid or revoked API key', code: 'UNAUTHORIZED' })
      }
      authed.user = { userId: result.userId, email: result.email, role: result.role as AuthPayload['role'] }
      authed.apiKeyId = result.apiKeyId
      authed.authMethod = 'api_key'
      return handler(authed, res)
    }

    // JWT auth
    try {
      const user = verifyToken(token)
      authed.user = user
      authed.authMethod = 'jwt'
      return handler(authed, res)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' })
    }
  }
}

export function withRateLimit(handler: AuthHandler, maxRequests = 60, windowMs = 60000) {
  return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    const key = `${req.user.userId}:global`
    const result = checkRateLimit(key, maxRequests, windowMs)

    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', result.remaining)
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retry_after_seconds: Math.ceil((result.resetAt - Date.now()) / 1000),
      })
    }

    return handler(req, res)
  })
}
