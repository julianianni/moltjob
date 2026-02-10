import crypto from 'crypto'

export function verifyCoinbaseWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('COINBASE_COMMERCE_WEBHOOK_SECRET is not configured')
  }

  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}
