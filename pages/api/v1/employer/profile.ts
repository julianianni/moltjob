import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import type { Employer } from '@/lib/types'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Only employers can access this endpoint', code: 'FORBIDDEN' })
  }

  if (req.method === 'GET') {
    const employer = await queryOne<Employer>(
      'SELECT * FROM employers WHERE user_id = $1',
      [req.user.userId]
    )
    if (!employer) {
      return res.status(404).json({ error: 'Profile not found. Create one with POST.', code: 'NOT_FOUND' })
    }
    return res.json(employer)
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const { company_name, company_description, industry, company_size, website } = req.body

    if (!company_name) {
      return res.status(400).json({ error: 'company_name is required', code: 'VALIDATION_ERROR' })
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
      await logActivity({ userId: req.user.userId, apiKeyId: req.apiKeyId, action: 'update_profile', resourceType: 'employer', resourceId: updated.id })
      return res.json(updated)
    }

    const [employer] = await query<Employer>(
      `INSERT INTO employers (user_id, company_name, company_description, industry, company_size, website)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.userId, company_name, company_description, industry, company_size, website]
    )
    await logActivity({ userId: req.user.userId, apiKeyId: req.apiKeyId, action: 'create_profile', resourceType: 'employer', resourceId: employer.id })
    return res.status(201).json(employer)
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
