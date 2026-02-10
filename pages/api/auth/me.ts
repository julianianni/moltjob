import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { queryOne } from '@/lib/db'
import type { JobSeeker, Employer } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, role } = req.user

  if (role === 'job_seeker') {
    const profile = await queryOne<JobSeeker>(
      'SELECT * FROM job_seekers WHERE user_id = $1',
      [userId]
    )
    return res.json({ user: req.user, profile })
  }

  const profile = await queryOne<Employer>(
    'SELECT * FROM employers WHERE user_id = $1',
    [userId]
  )
  return res.json({ user: req.user, profile })
})
