import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcrypt'
import { query, queryOne } from '@/lib/db'
import { signToken } from '@/lib/middleware'
import type { User } from '@/lib/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password, role } = req.body

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' })
  }

  if (role !== 'job_seeker' && role !== 'employer') {
    return res.status(400).json({ error: 'Role must be job_seeker or employer' })
  }

  const existing = await queryOne<User>(
    'SELECT id FROM users WHERE email = $1',
    [email]
  )

  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const [user] = await query<User>(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
    [email, passwordHash, role]
  )

  const token = signToken({ userId: user.id, email: user.email, role: user.role })

  return res.status(201).json({ user, token })
}
