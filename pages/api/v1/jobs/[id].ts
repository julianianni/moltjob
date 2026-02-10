import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { queryOne } from '@/lib/db'
import type { JobPosting } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  const job = await queryOne<JobPosting>(
    `SELECT jp.*, e.company_name
    FROM job_postings jp
    JOIN employers e ON e.id = jp.employer_id
    WHERE jp.id = $1`,
    [id]
  )

  if (!job) {
    return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' })
  }

  return res.json(job)
})
