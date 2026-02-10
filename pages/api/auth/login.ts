import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcrypt'
import { queryOne } from '@/lib/db'
import { signToken } from '@/lib/middleware'

interface UserRow {
  id: string
  email: string
  password_hash: string
  role: 'job_seeker' | 'employer'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = await queryOne<UserRow>(
    'SELECT id, email, password_hash, role FROM users WHERE email = $1',
    [email]
  )

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role })

  return res.json({
    user: { id: user.id, email: user.email, role: user.role },
    token,
  })
}
