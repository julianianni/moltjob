import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { JobSeeker } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can toggle agent' })
  }

  const seeker = await queryOne<JobSeeker>(
    'SELECT * FROM job_seekers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!seeker) {
    return res.status(400).json({ error: 'Complete your profile first' })
  }

  const [updated] = await query<JobSeeker>(
    'UPDATE job_seekers SET agent_active = NOT agent_active, updated_at = NOW() WHERE id = $1 RETURNING *',
    [seeker.id]
  )

  return res.json({
    agent_active: updated.agent_active,
    message: updated.agent_active ? 'Agent activated' : 'Agent deactivated',
  })
})
