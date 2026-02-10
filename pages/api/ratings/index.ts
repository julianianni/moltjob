import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { Rating, Employer, Application } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ error: 'Only employers can rate' })
    }

    const employer = await queryOne<Employer>(
      'SELECT id FROM employers WHERE user_id = $1',
      [req.user.userId]
    )

    if (!employer) {
      return res.status(400).json({ error: 'Employer profile not found' })
    }

    const { application_id, score, feedback } = req.body

    if (!application_id || !score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Valid application_id and score (1-5) are required' })
    }

    // Verify application belongs to this employer
    const application = await queryOne<Application & { job_seeker_id: string }>(
      `SELECT a.* FROM applications a
      JOIN job_postings jp ON jp.id = a.job_posting_id
      WHERE a.id = $1 AND jp.employer_id = $2`,
      [application_id, employer.id]
    )

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    const [rating] = await query<Rating>(
      `INSERT INTO ratings (job_seeker_id, employer_id, application_id, score, feedback)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [application.job_seeker_id, employer.id, application_id, score, feedback]
    )

    return res.status(201).json(rating)
  }

  if (req.method === 'GET') {
    const { seeker_id } = req.query

    if (seeker_id) {
      const ratings = await query<Rating>(
        'SELECT * FROM ratings WHERE job_seeker_id = $1 ORDER BY created_at DESC',
        [seeker_id]
      )
      const avg = await queryOne<{ avg_score: number; count: number }>(
        'SELECT AVG(score)::numeric(3,2) as avg_score, COUNT(*)::int as count FROM ratings WHERE job_seeker_id = $1',
        [seeker_id]
      )
      return res.json({ ratings, average: avg?.avg_score, total: avg?.count })
    }

    return res.status(400).json({ error: 'seeker_id query parameter required' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
