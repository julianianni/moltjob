import type { NextApiRequest, NextApiResponse } from 'next'
import { query, queryOne } from '@/lib/db'
import { verifyCoinbaseWebhook } from '@/lib/webhook'
import type { Payment } from '@/lib/types'

export const config = {
  api: {
    bodyParser: false,
  },
}

function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody = await getRawBody(req)
  const signature = req.headers['x-cc-webhook-signature'] as string

  if (!signature || !verifyCoinbaseWebhook(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  const event = JSON.parse(rawBody)
  const eventType = event.event?.type as string
  const chargeData = event.event?.data

  if (!chargeData?.id) {
    return res.status(400).json({ error: 'Missing charge data' })
  }

  const chargeId = chargeData.id as string
  const metadata = chargeData.metadata as Record<string, string> | undefined

  // Find the payment record
  const payment = await queryOne<Payment>(
    'SELECT * FROM payments WHERE coinbase_charge_id = $1',
    [chargeId]
  )

  // If no payment record, try to resolve from metadata (in case record wasn't created)
  const jobSeekerId = payment?.job_seeker_id ?? metadata?.job_seeker_id

  if (eventType === 'charge:confirmed' || eventType === 'charge:resolved') {
    // Update payment status
    if (payment) {
      await query(
        `UPDATE payments SET status = 'confirmed', updated_at = NOW() WHERE id = $1 AND status != 'confirmed'`,
        [payment.id]
      )
    }

    // Set has_paid on the job seeker
    if (jobSeekerId) {
      await query(
        'UPDATE job_seekers SET has_paid = true WHERE id = $1',
        [jobSeekerId]
      )
    }
  } else if (eventType === 'charge:failed') {
    if (payment) {
      await query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [payment.id]
      )
    }
  } else if (eventType === 'charge:pending') {
    if (payment) {
      await query(
        `UPDATE payments SET status = 'pending_confirmation', updated_at = NOW() WHERE id = $1`,
        [payment.id]
      )
    }
  }

  return res.status(200).json({ received: true })
}
