import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import type { Employer } from '@/lib/types'

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Only employers can access this endpoint' })
  }

  if (req.method === 'POST') {
    const { company_name, company_description, industry, company_size, website } = req.body

    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required' })
    }

    const existing = await queryOne<Employer>(
      'SELECT id FROM employers WHERE user_id = $1',
      [req.user.userId]
    )

    if (existing) {
      const [updated] = await query<Employer>(
        `UPDATE employers SET
          company_name = $1, company_description = $2,
          industry = $3, company_size = $4, website = $5, updated_at = NOW()
        WHERE user_id = $6 RETURNING *`,
        [company_name, company_description, industry, company_size, website, req.user.userId]
      )
      return res.json(updated)
    }

    const [employer] = await query<Employer>(
      `INSERT INTO employers (user_id, company_name, company_description, industry, company_size, website)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.userId, company_name, company_description, industry, company_size, website]
    )
    return res.status(201).json(employer)
  }

  if (req.method === 'GET') {
    const employer = await queryOne<Employer>(
      'SELECT * FROM employers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!employer) {
      return res.status(404).json({ error: 'Profile not found' })
    }
    return res.json(employer)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
