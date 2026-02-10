import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { createCharge } from '@/lib/coinbase'
import type { JobSeeker, Payment } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can access this endpoint', code: 'FORBIDDEN' })
  }

  const seeker = await queryOne<JobSeeker>(
    'SELECT * FROM job_seekers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!seeker) {
    return res.status(400).json({ error: 'Create your profile first', code: 'VALIDATION_ERROR' })
  }

  // Already paid — no need to create another charge
  if (seeker.has_paid) {
    return res.status(200).json({ already_paid: true })
  }

  // Reuse a pending charge created in the last hour
  const existingPayment = await queryOne<Payment>(
    `SELECT * FROM payments
     WHERE job_seeker_id = $1 AND status = 'pending'
       AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC LIMIT 1`,
    [seeker.id]
  )

  if (existingPayment?.hosted_url) {
    return res.status(200).json({ checkout_url: existingPayment.hosted_url })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const charge = await createCharge({
    userId: req.user.userId,
    jobSeekerId: seeker.id,
    redirectUrl: `${appUrl}/dashboard/seeker?payment=success`,
    cancelUrl: `${appUrl}/dashboard/seeker?payment=cancelled`,
  })

  await query(
    `INSERT INTO payments (user_id, job_seeker_id, coinbase_charge_id, coinbase_charge_code, status, hosted_url)
     VALUES ($1, $2, $3, $4, 'pending', $5)`,
    [req.user.userId, seeker.id, charge.id, charge.code, charge.hosted_url]
  )

  return res.status(201).json({ checkout_url: charge.hosted_url })
})
