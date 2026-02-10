import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { Application, JobSeeker, Employer } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role === 'job_seeker') {
    const seeker = await queryOne<JobSeeker>(
      'SELECT id FROM job_seekers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!seeker) {
      return res.json([])
    }

    const applications = await query<Application>(
      `SELECT a.*, jp.title as job_title, e.company_name
      FROM applications a
      JOIN job_postings jp ON jp.id = a.job_posting_id
      JOIN employers e ON e.id = jp.employer_id
      WHERE a.job_seeker_id = $1
      ORDER BY a.created_at DESC`,
      [seeker.id]
    )
    return res.json(applications)
  }

  if (req.user.role === 'employer') {
    const employer = await queryOne<Employer>(
      'SELECT id FROM employers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!employer) {
      return res.json([])
    }

    const { job_id } = req.query

    const params: unknown[] = [employer.id]
    let whereClause = 'WHERE jp.employer_id = $1'

    if (job_id) {
      whereClause += ' AND jp.id = $2'
      params.push(job_id)
    }

    const applications = await query<Application>(
      `SELECT a.*, jp.title as job_title, js.full_name as seeker_name
      FROM applications a
      JOIN job_postings jp ON jp.id = a.job_posting_id
      JOIN job_seekers js ON js.id = a.job_seeker_id
      ${whereClause}
      ORDER BY a.match_score DESC`,
      params
    )
    return res.json(applications)
  }

  return res.status(403).json({ error: 'Unauthorized' })
})
