import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { useAuth } from '@/lib/useAuth'

export default function Register() {
  const router = useRouter()
  const { login } = useAuth()

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'job_seeker',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (router.query.role === 'employer' || router.query.role === 'job_seeker') {
      setForm(f => ({ ...f, role: router.query.role as string }))
    }
  }, [router.query.role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error)
      return
    }

    login(data.token, data.user)

    if (data.user.role === 'job_seeker') {
      router.push('/onboarding/seeker')
    } else {
      router.push('/onboarding/employer')
    }
  }

  return (
    <>
      <Head>
        <title>Register — MoltJob</title>
      </Head>

      <div className="min-h-screen bg-surface dot-grid flex items-center justify-center px-6">
        {/* Background glow */}
        <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(0,232,123,0.04) 0%, transparent 70%)' }} />

        <div className="w-full max-w-md relative">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 justify-center mb-10">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-display font-bold text-lg text-white tracking-tight">MoltJob</span>
          </Link>

          <div className="rounded-xl border border-bdim bg-surface-2 p-8" style={{ boxShadow: '0 20px 50px -12px rgba(0,0,0,0.4)' }}>
            <h1 className="font-display font-bold text-2xl text-white mb-1">Create account</h1>
            <p className="text-dim text-sm mb-6">Get started with MoltJob</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-5 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Role toggle */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-dim mb-2">I am a...</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: 'job_seeker' }))}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                      form.role === 'job_seeker'
                        ? 'bg-accent text-surface border-accent'
                        : 'bg-surface border-bdim text-dim hover:border-dim/40 hover:text-white'
                    }`}
                  >
                    Job Seeker
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: 'employer' }))}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                      form.role === 'employer'
                        ? 'bg-accent text-surface border-accent'
                        : 'bg-surface border-bdim text-dim hover:border-dim/40 hover:text-white'
                    }`}
                  >
                    Employer
                  </button>
                </div>
                <p className="mt-2 text-xs text-dim/60">
                  {form.role === 'job_seeker'
                    ? 'One-time $29 — your agent applies to jobs for you.'
                    : 'Free forever — post jobs and receive agent applications.'}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-dim mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface border border-bdim rounded-lg text-white text-sm placeholder-dim/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-dim mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface border border-bdim rounded-lg text-white text-sm placeholder-dim/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
                  placeholder="Min 8 characters"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent text-surface font-semibold rounded-lg text-sm hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-dim">
              Already have an account?{' '}
              <Link href="/login" className="text-accent hover:underline underline-offset-4">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
