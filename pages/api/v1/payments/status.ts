import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { queryOne } from '@/lib/db'
import type { JobSeeker } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can access this endpoint', code: 'FORBIDDEN' })
  }

  const seeker = await queryOne<JobSeeker>(
    'SELECT has_paid FROM job_seekers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!seeker) {
    return res.status(400).json({ error: 'Create your profile first', code: 'VALIDATION_ERROR' })
  }

  return res.status(200).json({ has_paid: seeker.has_paid })
})
