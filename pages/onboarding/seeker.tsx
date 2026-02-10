import { useState } from 'react'
import { useRouter } from 'next/router'
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">Set Up Your Profile</h1>
        <p className="text-gray-600 mb-8">
          Your AI agent will use this information to find and apply to the best jobs for you.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resume / Bio *
            </label>
            <textarea
              required
              rows={8}
              placeholder="Paste your resume text or write a detailed bio..."
              value={form.resume_text}
              onChange={e => setForm(f => ({ ...f, resume_text: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              placeholder="React, TypeScript, Node.js, Python..."
              value={form.skills}
              onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Job Titles (comma-separated)
            </label>
            <input
              type="text"
              placeholder="Software Engineer, Full Stack Developer..."
              value={form.preferred_job_titles}
              onChange={e => setForm(f => ({ ...f, preferred_job_titles: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Locations (comma-separated)
            </label>
            <input
              type="text"
              placeholder="San Francisco, New York, Remote..."
              value={form.preferred_locations}
              onChange={e => setForm(f => ({ ...f, preferred_locations: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Salary ($)
              </label>
              <input
                type="number"
                placeholder="80000"
                value={form.min_salary}
                onChange={e => setForm(f => ({ ...f, min_salary: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Salary ($)
              </label>
              <input
                type="number"
                placeholder="150000"
                value={form.max_salary}
                onChange={e => setForm(f => ({ ...f, max_salary: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Years of Experience
              </label>
              <input
                type="number"
                placeholder="5"
                value={form.experience_years}
                onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remote Preference
              </label>
              <select
                value={form.remote_preference}
                onChange={e => setForm(f => ({ ...f, remote_preference: e.target.value as typeof form.remote_preference }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="any">Any</option>
                <option value="remote">Remote Only</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Saving...' : 'Save & Go to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
