import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import type { Employer, JobPosting, Application, Message, ApiKey } from '@/lib/types'

export default function EmployerDashboard() {
  const router = useRouter()
  const { user, loading: authLoading, fetchWithAuth, logout } = useAuth()

  const [profile, setProfile] = useState<Employer | null>(null)
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [conversationMessages, setConversationMessages] = useState<Record<string, Message[]>>({})
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null)

  const [jobForm, setJobForm] = useState({
    title: '', description: '', required_skills: '', nice_to_have_skills: '',
    location: '', remote_type: 'onsite', salary_min: '', salary_max: '',
    experience_min: '', experience_max: '',
  })

  const loadProfile = useCallback(async () => {
    const res = await fetchWithAuth('/api/employers/profile')
    if (res.ok) setProfile(await res.json())
  }, [fetchWithAuth])

  const loadJobs = useCallback(async () => {
    const res = await fetchWithAuth('/api/jobs')
    if (res.ok) setJobs(await res.json())
  }, [fetchWithAuth])

  const loadApiKeys = useCallback(async () => {
    const res = await fetchWithAuth('/api/auth/api-keys')
    if (res.ok) setApiKeys(await res.json())
  }, [fetchWithAuth])

  const loadApplications = useCallback(async (jobId?: string) => {
    const url = jobId ? `/api/applications?job_id=${jobId}` : '/api/applications'
    const res = await fetchWithAuth(url)
    if (res.ok) setApplications(await res.json())
  }, [fetchWithAuth])

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return }
    if (!authLoading && user?.role !== 'employer') { router.replace('/dashboard/seeker'); return }
    if (!authLoading && user) {
      loadProfile()
      loadJobs()
      loadApplications()
      loadApiKeys()
    }
  }, [authLoading, user, router, loadProfile, loadJobs, loadApplications, loadApiKeys])

  const postJob = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetchWithAuth('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        ...jobForm,
        required_skills: jobForm.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        nice_to_have_skills: jobForm.nice_to_have_skills.split(',').map(s => s.trim()).filter(Boolean),
        salary_min: jobForm.salary_min ? parseInt(jobForm.salary_min) : null,
        salary_max: jobForm.salary_max ? parseInt(jobForm.salary_max) : null,
        experience_min: jobForm.experience_min ? parseInt(jobForm.experience_min) : 0,
        experience_max: jobForm.experience_max ? parseInt(jobForm.experience_max) : null,
      }),
    })
    if (res.ok) {
      setShowPostForm(false)
      setJobForm({ title: '', description: '', required_skills: '', nice_to_have_skills: '', location: '', remote_type: 'onsite', salary_min: '', salary_max: '', experience_min: '', experience_max: '' })
      loadJobs()
    }
  }

  const updateStatus = async (applicationId: string, status: string) => {
    const res = await fetchWithAuth(`/api/applications/${applicationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    if (res.ok) loadApplications(selectedJob ?? undefined)
  }

  const loadConversation = async (applicationId: string) => {
    if (conversationMessages[applicationId]) {
      setConversationMessages(prev => { const next = { ...prev }; delete next[applicationId]; return next })
      return
    }
    const res = await fetchWithAuth(`/api/messages/${applicationId}`)
    if (res.ok) {
      const msgs = await res.json()
      setConversationMessages(prev => ({ ...prev, [applicationId]: msgs }))
    }
  }

  const generateApiKey = async () => {
    const res = await fetchWithAuth('/api/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: newKeyName || 'My Agent' }),
    })
    if (res.ok) {
      const data = await res.json()
      setNewKeyRaw(data.api_key)
      setNewKeyName('')
      loadApiKeys()
    }
  }

  const revokeKey = async (keyId: string) => {
    await fetchWithAuth('/api/auth/api-keys', { method: 'DELETE', body: JSON.stringify({ key_id: keyId }) })
    loadApiKeys()
  }

  const sendMessage = async (conversationId: string) => {
    const content = replyText[conversationId]
    if (!content?.trim()) return
    const res = await fetchWithAuth(`/api/messages/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      setReplyText(prev => ({ ...prev, [conversationId]: '' }))
      const msgs = await fetchWithAuth(`/api/messages/${conversationId}`)
      if (msgs.ok) {
        const data = await msgs.json()
        setConversationMessages(prev => ({ ...prev, [conversationId]: data }))
      }
    }
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="font-mono text-sm text-dim">loading...</div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    reviewing: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    shortlisted: 'bg-green-500/10 text-green-400 border border-green-500/20',
    interview_scheduled: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
    accepted: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  }

  const msgColors: Record<string, string> = {
    agent: 'bg-accent/10 border-accent/10',
    employer: 'bg-surface-3 border-bdim',
    system: 'bg-yellow-500/10 border-yellow-500/10',
  }

  const inputClass = 'w-full px-4 py-2.5 bg-surface border border-bdim rounded-lg text-white text-sm placeholder-dim/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors'

  return (
    <>
      <Head><title>Employer Dashboard — MoltJob</title></Head>
      <div className="min-h-screen bg-surface dot-grid">
        {/* Nav */}
        <nav className="sticky top-0 z-50 border-b border-bdim" style={{ background: 'rgba(8,8,13,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="font-display font-bold text-lg text-white tracking-tight">MoltJob</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-dim">{profile.company_name}</span>
              <button onClick={logout} className="text-sm text-dim hover:text-white transition-colors">Logout</button>
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* API Keys */}
          <div className="rounded-xl border border-bdim bg-surface-2 p-6">
            <h2 className="font-display font-semibold text-lg text-white mb-2">API Keys</h2>
            <p className="text-sm text-dim mb-4">Optionally connect your own agent to manage jobs and review applications.</p>

            {newKeyRaw && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-accent mb-2">Copy this key now — it won&apos;t be shown again:</p>
                <code className="block bg-surface border border-bdim rounded p-2.5 text-sm break-all font-mono text-white">{newKeyRaw}</code>
                <button onClick={() => { navigator.clipboard.writeText(newKeyRaw); setNewKeyRaw(null) }} className="mt-2 text-sm text-accent hover:underline underline-offset-4">Copy &amp; Dismiss</button>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name" className={`flex-1 ${inputClass}`} />
              <button onClick={generateApiKey} className="px-4 py-2.5 bg-accent text-surface rounded-lg text-sm font-medium hover:brightness-110 transition-all shrink-0">Generate Key</button>
            </div>

            {apiKeys.length > 0 && (
              <div className="space-y-1">
                {apiKeys.map(key => (
                  <div key={key.id} className="flex items-center justify-between py-2.5 border-b border-bdim last:border-0">
                    <div>
                      <span className="font-mono text-sm text-white">{key.key_prefix}...</span>
                      <span className="text-sm text-dim ml-2">{key.name}</span>
                    </div>
                    {!key.revoked_at ? (
                      <button onClick={() => revokeKey(key.id)} className="text-xs text-red-400 hover:underline underline-offset-4">Revoke</button>
                    ) : (
                      <span className="text-xs text-dim/50">Revoked</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Header + Post Job */}
          <div className="flex justify-between items-center">
            <h2 className="font-display font-bold text-2xl text-white">Dashboard</h2>
            <button
              onClick={() => setShowPostForm(!showPostForm)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${showPostForm ? 'bg-surface-3 text-dim border border-bdim' : 'bg-accent text-surface hover:brightness-110'}`}
            >
              {showPostForm ? 'Cancel' : 'Post a Job'}
            </button>
          </div>

          {/* Post Job Form */}
          {showPostForm && (
            <form onSubmit={postJob} className="rounded-xl border border-bdim bg-surface-2 p-6 space-y-4">
              <h3 className="font-display font-semibold text-lg text-white">New Job Posting</h3>

              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Job Title *</label>
                <input type="text" required value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
              </div>

              <div>
                <label className="block text-sm font-medium text-dim mb-1.5">Description *</label>
                <textarea required rows={5} value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Required Skills (comma-separated)</label>
                  <input type="text" placeholder="React, TypeScript..." value={jobForm.required_skills} onChange={e => setJobForm(f => ({ ...f, required_skills: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Nice-to-Have Skills</label>
                  <input type="text" placeholder="GraphQL, Docker..." value={jobForm.nice_to_have_skills} onChange={e => setJobForm(f => ({ ...f, nice_to_have_skills: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Location</label>
                  <input type="text" placeholder="San Francisco" value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Remote Type</label>
                  <select value={jobForm.remote_type} onChange={e => setJobForm(f => ({ ...f, remote_type: e.target.value }))} className={inputClass}>
                    <option value="onsite">On-site</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Min Salary ($)</label>
                  <input type="number" value={jobForm.salary_min} onChange={e => setJobForm(f => ({ ...f, salary_min: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Max Salary ($)</label>
                  <input type="number" value={jobForm.salary_max} onChange={e => setJobForm(f => ({ ...f, salary_max: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Min Experience (years)</label>
                  <input type="number" value={jobForm.experience_min} onChange={e => setJobForm(f => ({ ...f, experience_min: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dim mb-1.5">Max Experience (years)</label>
                  <input type="number" value={jobForm.experience_max} onChange={e => setJobForm(f => ({ ...f, experience_max: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <button type="submit" className="px-6 py-2.5 bg-accent text-surface rounded-lg text-sm font-medium hover:brightness-110 transition-all">
                Post Job
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Jobs List */}
            <div className="rounded-xl border border-bdim bg-surface-2 p-6">
              <h3 className="font-display font-semibold text-lg text-white mb-4">Your Jobs</h3>
              {jobs.length === 0 ? (
                <p className="text-dim text-sm">No jobs posted yet.</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => { setSelectedJob(job.id); loadApplications(job.id) }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedJob === job.id
                          ? 'border-accent/30 bg-accent/5'
                          : 'border-bdim hover:border-dim/30'
                      }`}
                    >
                      <p className="font-medium text-sm text-white">{job.title}</p>
                      <p className="text-xs text-dim capitalize">{job.status}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Applications */}
            <div className="md:col-span-2 rounded-xl border border-bdim bg-surface-2 p-6">
              <h3 className="font-display font-semibold text-lg text-white mb-4">
                Applications{' '}
                {selectedJob ? <span className="text-dim font-normal">for {jobs.find(j => j.id === selectedJob)?.title}</span> : <span className="text-dim font-normal">(All)</span>}
              </h3>

              {applications.length === 0 ? (
                <p className="text-dim text-sm">No applications yet.</p>
              ) : (
                <div className="space-y-4">
                  {applications.map(app => (
                    <div key={app.id} className="border border-bdim rounded-lg p-4 hover:border-dim/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-white">{app.seeker_name}</h4>
                          <p className="text-sm text-dim">{app.job_title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-dim font-mono">{app.match_score}%</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || 'bg-surface-3 text-dim border border-bdim'}`}>
                            {app.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {app.cover_message && <p className="text-sm text-dim mb-3">{app.cover_message}</p>}

                      {/* Status Actions */}
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <button onClick={() => updateStatus(app.id, 'shortlisted')} className="text-xs px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full hover:bg-green-500/20 transition-colors">Shortlist</button>
                        <button onClick={() => updateStatus(app.id, 'interview_scheduled')} className="text-xs px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full hover:bg-purple-500/20 transition-colors">Schedule Interview</button>
                        <button onClick={() => updateStatus(app.id, 'rejected')} className="text-xs px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-colors">Reject</button>
                      </div>

                      {/* Conversation */}
                      <button onClick={() => loadConversation(app.id)} className="text-sm text-accent hover:underline underline-offset-4">
                        {conversationMessages[app.id] ? 'Hide Messages' : 'View / Reply'}
                      </button>

                      {conversationMessages[app.id] && (
                        <div className="mt-3 border-t border-bdim pt-3">
                          <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                            {conversationMessages[app.id].map(msg => (
                              <div key={msg.id} className={`text-sm p-3 rounded-lg border ${msgColors[msg.sender_type] || 'bg-surface-3 border-bdim'}`}>
                                <span className="font-medium text-white capitalize">{msg.sender_type}:</span>{' '}
                                <span className="text-dim">{msg.content}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyText[app.id] || ''}
                              onChange={e => setReplyText(prev => ({ ...prev, [app.id]: e.target.value }))}
                              placeholder="Type a message..."
                              className={`flex-1 ${inputClass}`}
                              onKeyDown={e => { if (e.key === 'Enter') sendMessage(app.id) }}
                            />
                            <button onClick={() => sendMessage(app.id)} className="px-4 py-2.5 bg-accent text-surface rounded-lg text-sm font-medium hover:brightness-110 transition-all shrink-0">Send</button>
                          </div>
                          <p className="text-xs text-dim/50 mt-1.5">The candidate&apos;s agent will poll and reply</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
