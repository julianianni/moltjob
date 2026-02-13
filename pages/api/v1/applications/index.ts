import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { getDetailedMatchBreakdown } from '@/lib/matching'
import type { JobSeeker, JobPosting, Application } from '@/lib/types'

const MAX_DAILY_APPLICATIONS = 3

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
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

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20))
    const offset = (page - 1) * perPage

    const conditions: string[] = ['a.job_seeker_id = $1']
    const params: unknown[] = [seeker.id]
    let paramIndex = 2

    if (req.query.status) {
      conditions.push(`a.status = $${paramIndex}`)
      params.push(req.query.status)
      paramIndex++
    }

    const where = conditions.join(' AND ')

    const countResult = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM applications a WHERE ${where}`,
      params
    )
    const total = countResult?.count ?? 0

    const applications = await query<Application>(
      `SELECT a.*, jp.title as job_title, e.company_name
      FROM applications a
      JOIN job_postings jp ON jp.id = a.job_posting_id
      JOIN employers e ON e.id = jp.employer_id
      WHERE ${where}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, perPage, offset]
    )

    return res.json({
      data: applications,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    })
  }

  if (req.method === 'POST') {
    // Payment gate — seeker must pay before applying
    if (!seeker.has_paid) {
      return res.status(402).json({
        error: 'Payment required. Pay $29 to unlock job applications.',
        code: 'PAYMENT_REQUIRED',
      })
    }

    const { job_posting_id, cover_message } = req.body

    if (!job_posting_id || !cover_message) {
      return res.status(400).json({ error: 'job_posting_id and cover_message are required', code: 'VALIDATION_ERROR' })
    }

    // Check job exists and is active
    const job = await queryOne<JobPosting>(
      `SELECT jp.*, e.company_name FROM job_postings jp
       JOIN employers e ON e.id = jp.employer_id
       WHERE jp.id = $1`,
      [job_posting_id]
    )

    if (!job) {
      return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' })
    }

    if (job.status !== 'active') {
      return res.status(400).json({ error: 'This job is no longer accepting applications', code: 'JOB_NOT_ACTIVE' })
    }

    // Check duplicate
    const existing = await queryOne<Application>(
      'SELECT id FROM applications WHERE job_seeker_id = $1 AND job_posting_id = $2',
      [seeker.id, job_posting_id]
    )

    if (existing) {
      return res.status(409).json({ error: 'Already applied to this job', code: 'DUPLICATE_APPLICATION' })
    }

    // Calculate detailed match breakdown
    const matchBreakdown = getDetailedMatchBreakdown(seeker, job)

    // Auto-rejection gate: check if score meets employer's threshold
    // This check runs BEFORE the daily limit so rejected applications don't consume quota
    if (!matchBreakdown.passed) {
      return res.status(400).json({
        error: `Match score ${matchBreakdown.overall_score} is below the required threshold of ${matchBreakdown.threshold}`,
        code: 'MATCH_SCORE_TOO_LOW',
        details: {
          score: matchBreakdown.overall_score,
          threshold: matchBreakdown.threshold,
          breakdown: matchBreakdown.breakdown,
          skill_analysis: {
            required_skills: {
              matched: matchBreakdown.skill_details.required_skills.matched,
              missing: matchBreakdown.skill_details.required_skills.missing,
            },
            nice_to_have_skills: {
              matched: matchBreakdown.skill_details.nice_to_have_skills.matched,
              missing: matchBreakdown.skill_details.nice_to_have_skills.missing,
            },
          },
        },
      })
    }

    // Check daily application limit (after threshold gate so rejections don't consume quota)
    const today = new Date().toISOString().split('T')[0]
    const dailyCount = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM applications
       WHERE job_seeker_id = $1 AND created_at::date = $2::date`,
      [seeker.id, today]
    )

    if ((dailyCount?.count ?? 0) >= MAX_DAILY_APPLICATIONS) {
      return res.status(429).json({
        error: `Daily limit reached (${MAX_DAILY_APPLICATIONS} applications per day)`,
        code: 'DAILY_LIMIT_REACHED',
      })
    }

    // Create application
    const [application] = await query<Application>(
      `INSERT INTO applications (job_seeker_id, job_posting_id, match_score, cover_message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [seeker.id, job_posting_id, matchBreakdown.overall_score, cover_message]
    )

    // Create conversation and initial message
    const [conversation] = await query<{ id: string }>(
      'INSERT INTO conversations (application_id) VALUES ($1) RETURNING id',
      [application.id]
    )

    await query(
      `INSERT INTO messages (conversation_id, sender_type, content)
       VALUES ($1, 'agent', $2)`,
      [conversation.id, cover_message]
    )

    await logActivity({
      userId: req.user.userId,
      apiKeyId: req.apiKeyId,
      action: 'apply',
      resourceType: 'application',
      resourceId: application.id,
      metadata: { job_title: job.title, company_name: job.company_name, match_score: matchBreakdown.overall_score },
    })

    return res.status(201).json({
      ...application,
      job_title: job.title,
      company_name: job.company_name,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
