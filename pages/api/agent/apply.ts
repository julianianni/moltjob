import type { NextApiResponse } from 'next'
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'
import { matchJobsForSeeker } from '@/lib/matching'
import { generateCoverMessage } from '@/lib/agent'
import type { JobSeeker, JobPosting, Application } from '@/lib/types'

const MAX_DAILY_APPLICATIONS = 3

export default withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.user.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can use agent apply' })
  }

  const seeker = await queryOne<JobSeeker>(
    'SELECT * FROM job_seekers WHERE user_id = $1',
    [req.user.userId]
  )

  if (!seeker) {
    return res.status(400).json({ error: 'Complete your profile first' })
  }

  if (!seeker.agent_active) {
    return res.status(400).json({ error: 'Agent is not active. Activate your agent first.' })
  }

  if (!seeker.has_paid) {
    return res.status(402).json({ error: 'Payment required to use agent' })
  }

  // Reset daily counter if new day
  const today = new Date().toISOString().split('T')[0]
  if (seeker.last_application_date !== today) {
    await query(
      'UPDATE job_seekers SET applications_today = 0, last_application_date = $1 WHERE id = $2',
      [today, seeker.id]
    )
    seeker.applications_today = 0
  }

  if (seeker.applications_today >= MAX_DAILY_APPLICATIONS) {
    return res.status(429).json({
      error: `Daily limit reached (${MAX_DAILY_APPLICATIONS} applications per day)`,
      applications_today: seeker.applications_today,
    })
  }

  // Get active jobs the seeker hasn't applied to
  const jobs = await query<JobPosting>(
    `SELECT jp.*, e.company_name
    FROM job_postings jp
    JOIN employers e ON e.id = jp.employer_id
    WHERE jp.status = 'active'
    AND jp.id NOT IN (
      SELECT job_posting_id FROM applications WHERE job_seeker_id = $1
    )`,
    [seeker.id]
  )

  if (jobs.length === 0) {
    return res.json({ message: 'No new matching jobs found', applications: [] })
  }

  // Match and rank jobs
  const ranked = matchJobsForSeeker(seeker, jobs)
  const remaining = MAX_DAILY_APPLICATIONS - seeker.applications_today
  const topJobs = ranked.slice(0, remaining)

  const applications: Application[] = []

  for (const match of topJobs) {
    const coverMessage = await generateCoverMessage(seeker, match.job_posting)

    const [application] = await query<Application>(
      `INSERT INTO applications (job_seeker_id, job_posting_id, match_score, cover_message)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [seeker.id, match.job_posting.id, match.score, coverMessage]
    )

    // Create conversation for this application
    const [conversation] = await query<{ id: string }>(
      'INSERT INTO conversations (application_id) VALUES ($1) RETURNING id',
      [application.id]
    )

    // Add cover message as first message
    await query(
      `INSERT INTO messages (conversation_id, sender_type, content)
      VALUES ($1, 'agent', $2)`,
      [conversation.id, coverMessage]
    )

    applications.push(application)
  }

  // Update daily counter
  await query(
    'UPDATE job_seekers SET applications_today = applications_today + $1, last_application_date = $2 WHERE id = $3',
    [applications.length, today, seeker.id]
  )

  return res.json({
    message: `Applied to ${applications.length} job(s)`,
    applications,
  })
})
