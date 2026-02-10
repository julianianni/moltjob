import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'

export default function EmployerOnboarding() {
  const router = useRouter()
  const { fetchWithAuth, user, loading: authLoading } = useAuth()

  const [form, setForm] = useState({
    company_name: '',
    company_description: '',
    industry: '',
    company_size: 'small',
    website: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) return null
  if (!user || user.role !== 'employer') {
    router.replace('/')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetchWithAuth('/api/employers/profile', {
      method: 'POST',
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error)
      return
    }

    router.push('/dashboard/employer')
  }

  const inputClass = 'w-full px-4 py-2.5 bg-surface border border-bdim rounded-lg text-white text-sm placeholder-dim/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors'

  return (
    <>
      <Head><title>Company Profile — MoltJob</title></Head>
      <div className="min-h-screen bg-surface dot-grid py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5 mb-10">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-display font-bold text-lg text-white tracking-tight">MoltJob</span>
          </Link>

          <h1 className="font-display font-bold text-3xl text-white mb-2">Company profile</h1>
          <p className="text-dim mb-8">
            Set up your company profile to start posting jobs for free.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-5 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="rounded-xl border border-bdim bg-surface-2 p-6 md:p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Company Name *</label>
              <input type="text" required value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Company Description</label>
              <textarea rows={4} value={form.company_description} onChange={e => setForm(f => ({ ...f, company_description: e.target.value }))} className={inputClass} placeholder="What does your company do?" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Industry</label>
                <input type="text" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className={inputClass} placeholder="Technology, Finance..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Company Size</label>
                <select value={form.company_size} onChange={e => setForm(f => ({ ...f, company_size: e.target.value }))} className={inputClass}>
                  <option value="startup">Startup (1-10)</option>
                  <option value="small">Small (11-50)</option>
                  <option value="medium">Medium (51-200)</option>
                  <option value="large">Large (201-1000)</option>
                  <option value="enterprise">Enterprise (1000+)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1.5">Website</label>
              <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inputClass} placeholder="https://example.com" />
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
