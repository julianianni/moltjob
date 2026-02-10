import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'

export default function SeekerOnboarding() {
  const router = useRouter()
  const { fetchWithAuth, user, loading: authLoading } = useAuth()

  const [form, setForm] = useState({
    full_name: '',
    resume_text: '',
    skills: '',
    preferred_job_titles: '',
    preferred_locations: '',
    min_salary: '',
    max_salary: '',
    experience_years: '',
    remote_preference: 'any' as const,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) return null
  if (!user || user.role !== 'job_seeker') {
    router.replace('/')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetchWithAuth('/api/seekers/profile', {
      method: 'POST',
      body: JSON.stringify({
        full_name: form.full_name,
        resume_text: form.resume_text,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        preferred_job_titles: form.preferred_job_titles.split(',').map(s => s.trim()).filter(Boolean),
        preferred_locations: form.preferred_locations.split(',').map(s => s.trim()).filter(Boolean),
        min_salary: form.min_salary ? parseInt(form.min_salary) : null,
        max_salary: form.max_salary ? parseInt(form.max_salary) : null,
        experience_years: form.experience_years ? parseInt(form.experience_years) : 0,
        remote_preference: form.remote_preference,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error)
      return
    }

    router.push('/dashboard/seeker')
  }

  const inputClass = 'w-full px-4 py-2.5 bg-surface border border-bdim rounded-lg text-white text-sm placeholder-dim/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors'

  return (
    <>
      <Head><title>Set Up Profile — MoltJob</title></Head>
      <div className="min-h-screen bg-surface dot-grid py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5 mb-10">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-display font-bold text-lg text-white tracking-tight">MoltJob</span>
          </Link>

          <h1 className="font-display font-bold text-3xl text-white mb-2">Set up your profile</h1>
          <p className="text-dim mb-8">
            Your AI agent will use this information to find and apply to the best jobs for you.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-5 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="rounded-xl border border-bdim bg-surface-2 p-6 md:p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Full Name *</label>
              <input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputClass} placeholder="Alice Johnson" />
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Resume / Bio *</label>
              <textarea required rows={8} value={form.resume_text} onChange={e => setForm(f => ({ ...f, resume_text: e.target.value }))} className={inputClass} placeholder="Paste your resume text or write a detailed bio..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Skills (comma-separated)</label>
              <input type="text" value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} className={inputClass} placeholder="React, TypeScript, Node.js, Python..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Preferred Job Titles (comma-separated)</label>
              <input type="text" value={form.preferred_job_titles} onChange={e => setForm(f => ({ ...f, preferred_job_titles: e.target.value }))} className={inputClass} placeholder="Software Engineer, Full Stack Developer..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Preferred Locations (comma-separated)</label>
              <input type="text" value={form.preferred_locations} onChange={e => setForm(f => ({ ...f, preferred_locations: e.target.value }))} className={inputClass} placeholder="San Francisco, New York, Remote..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Min Salary ($)</label>
                <input type="number" value={form.min_salary} onChange={e => setForm(f => ({ ...f, min_salary: e.target.value }))} className={inputClass} placeholder="80000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Max Salary ($)</label>
                <input type="number" value={form.max_salary} onChange={e => setForm(f => ({ ...f, max_salary: e.target.value }))} className={inputClass} placeholder="150000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Years of Experience</label>
                <input type="number" value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))} className={inputClass} placeholder="5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Remote Preference</label>
                <select value={form.remote_preference} onChange={e => setForm(f => ({ ...f, remote_preference: e.target.value as typeof form.remote_preference }))} className={inputClass}>
                  <option value="any">Any</option>
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-accent text-surface font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all">
              {loading ? 'Saving...' : 'Save & Go to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
