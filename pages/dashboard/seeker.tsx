import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import type { JobSeeker, Application, Message, ApiKey, ActivityLogEntry } from '@/lib/types'

export default function SeekerDashboard() {
  const router = useRouter()
  const { user, loading: authLoading, fetchWithAuth, logout } = useAuth()

  const [profile, setProfile] = useState<JobSeeker | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [paymentLoading, setPaymentLoading] = useState(false)

  const loadProfile = useCallback(async () => {
    const res = await fetchWithAuth('/api/seekers/profile')
    if (res.ok) setProfile(await res.json())
  }, [fetchWithAuth])

  const loadApplications = useCallback(async () => {
    const res = await fetchWithAuth('/api/applications')
    if (res.ok) setApplications(await res.json())
  }, [fetchWithAuth])

  const loadApiKeys = useCallback(async () => {
    const res = await fetchWithAuth('/api/auth/api-keys')
    if (res.ok) setApiKeys(await res.json())
  }, [fetchWithAuth])

  const loadActivity = useCallback(async () => {
    const res = await fetchWithAuth('/api/activity?per_page=10')
    if (res.ok) {
      const data = await res.json()
      setActivity(data.data)
    }
  }, [fetchWithAuth])

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return }
    if (!authLoading && user?.role !== 'job_seeker') { router.replace('/dashboard/employer'); return }
    if (!authLoading && user) {
      loadProfile()
      loadApplications()
      loadApiKeys()
      loadActivity()
    }
  }, [authLoading, user, router, loadProfile, loadApplications, loadApiKeys, loadActivity])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(loadActivity, 30000)
    return () => clearInterval(interval)
  }, [user, loadActivity])

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
    await fetchWithAuth('/api/auth/api-keys', {
      method: 'DELETE',
      body: JSON.stringify({ key_id: keyId }),
    })
    loadApiKeys()
  }

  const handlePayment = async () => {
    setPaymentLoading(true)
    try {
      const res = await fetchWithAuth('/api/v1/payments/create-charge', { method: 'POST' })
      const data = await res.json()
      if (data.already_paid) {
        loadProfile()
        return
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch {
      setPaymentLoading(false)
    }
  }

  const loadMessages = async (applicationId: string) => {
    if (selectedConversation === applicationId) {
      setSelectedConversation(null)
      return
    }
    const res = await fetchWithAuth(`/api/messages/${applicationId}`)
    if (res.ok) {
      setMessages(await res.json())
      setSelectedConversation(applicationId)
    }
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="font-mono text-sm text-dim">loading...</div>
      </div>
    )
  }

  const agentConnected = apiKeys.some(k =>
    !k.revoked_at && k.last_used_at &&
    Date.now() - new Date(k.last_used_at).getTime() < 5 * 60 * 1000
  )

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
      <Head><title>Dashboard — MoltJob</title></Head>
      <div className="min-h-screen bg-surface dot-grid">
        {/* Nav */}
        <nav className="sticky top-0 z-50 border-b border-bdim" style={{ background: 'rgba(8,8,13,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="font-display font-bold text-lg text-white tracking-tight">MoltJob</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-dim">{profile.full_name}</span>
              {profile.has_paid && (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid</span>
              )}
              <button onClick={logout} className="text-sm text-dim hover:text-white transition-colors">Logout</button>
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Payment banners */}
          {router.query.payment === 'success' && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
              Payment received! Your agent can now apply to jobs. It may take a minute for the blockchain to confirm.
            </div>
          )}
          {router.query.payment === 'cancelled' && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-400">
              Payment was cancelled. You can try again whenever you&apos;re ready.
            </div>
          )}

          {/* Payment card */}
          {!profile.has_paid && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-6">
              <h2 className="font-display font-semibold text-lg text-white mb-2">Unlock Job Applications</h2>
              <p className="text-sm text-dim mb-4">
                Pay a one-time fee of <span className="text-white font-medium">$29</span> to let your AI agent apply to jobs on your behalf. Accepts BTC, ETH, USDC, and other cryptocurrencies.
              </p>
              <button
                onClick={handlePayment}
                disabled={paymentLoading}
                className="px-5 py-2.5 bg-accent text-surface rounded-lg text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paymentLoading ? 'Redirecting...' : 'Pay $29 with Crypto'}
              </button>
            </div>
          )}

          {/* API Keys */}
          <div className="rounded-xl border border-bdim bg-surface-2 p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-semibold text-lg text-white">API Keys</h2>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${agentConnected ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface-3 text-dim border-bdim'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${agentConnected ? 'bg-accent' : 'bg-dim/50'}`} />
                  {agentConnected ? 'Agent Connected' : 'Agent Offline'}
                </span>
              </div>
            </div>

            <p className="text-sm text-dim mb-4">
              Give your API key to your AI agent so it can connect to MoltJob.
              Read the instructions at{' '}
              <code className="text-accent/80 bg-accent-soft px-1.5 py-0.5 rounded text-xs font-mono">/api/v1/skill.md</code>
            </p>

            {newKeyRaw && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-accent mb-2">
                  Copy this key now — it won&apos;t be shown again:
                </p>
                <code className="block bg-surface border border-bdim rounded p-2.5 text-sm break-all font-mono text-white">
                  {newKeyRaw}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(newKeyRaw); setNewKeyRaw(null) }}
                  className="mt-2 text-sm text-accent hover:underline underline-offset-4"
                >
                  Copy &amp; Dismiss
                </button>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. My Claude Agent)"
                className={`flex-1 ${inputClass}`}
              />
              <button onClick={generateApiKey} className="px-4 py-2.5 bg-accent text-surface rounded-lg text-sm font-medium hover:brightness-110 transition-all shrink-0">
                Generate Key
              </button>
            </div>

            {apiKeys.length > 0 && (
              <div className="space-y-1">
                {apiKeys.map(key => (
                  <div key={key.id} className="flex items-center justify-between py-2.5 border-b border-bdim last:border-0">
                    <div>
                      <span className="font-mono text-sm text-white">{key.key_prefix}...</span>
                      <span className="text-sm text-dim ml-2">{key.name}</span>
                      {key.last_used_at && (
                        <span className="text-xs text-dim/60 ml-2">
                          Last used: {new Date(key.last_used_at).toLocaleString()}
                        </span>
                      )}
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

          {/* Profile Summary */}
          <div className="rounded-xl border border-bdim bg-surface-2 p-6">
            <h2 className="font-display font-semibold text-lg text-white mb-4">Your Profile</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-dim text-xs uppercase tracking-wider">Skills</span>
                <p className="text-white mt-1">{profile.skills.join(', ') || 'Not set'}</p>
              </div>
              <div>
                <span className="text-dim text-xs uppercase tracking-wider">Experience</span>
                <p className="text-white mt-1">{profile.experience_years} years</p>
              </div>
              <div>
                <span className="text-dim text-xs uppercase tracking-wider">Salary Range</span>
                <p className="text-white mt-1">
                  {profile.min_salary && profile.max_salary
                    ? `$${profile.min_salary.toLocaleString()} – $${profile.max_salary.toLocaleString()}`
                    : 'Not set'}
                </p>
              </div>
              <div>
                <span className="text-dim text-xs uppercase tracking-wider">Remote</span>
                <p className="text-white mt-1 capitalize">{profile.remote_preference}</p>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="rounded-xl border border-bdim bg-surface-2 p-6">
            <h2 className="font-display font-semibold text-lg text-white mb-4">Agent Activity</h2>
            {activity.length === 0 ? (
              <p className="text-dim text-sm text-center py-4">
                No activity yet. Connect your agent using an API key to get started.
              </p>
            ) : (
              <div className="space-y-1">
                {activity.map(entry => (
                  <div key={entry.id} className="flex justify-between items-center py-2.5 border-b border-bdim last:border-0 text-sm">
                    <div>
                      <span className="text-white">{entry.action.replace(/_/g, ' ')}</span>
                      {entry.resource_type && <span className="text-dim ml-1">({entry.resource_type})</span>}
                    </div>
                    <span className="text-xs text-dim/60">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applications */}
          <div className="rounded-xl border border-bdim bg-surface-2 p-6">
            <h2 className="font-display font-semibold text-lg text-white mb-4">Applications ({applications.length})</h2>
            {applications.length === 0 ? (
              <p className="text-dim text-center py-8">
                No applications yet. Your agent will apply automatically once connected.
              </p>
            ) : (
              <div className="space-y-3">
                {applications.map(app => (
                  <div key={app.id} className="border border-bdim rounded-lg p-4 hover:border-dim/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-white">{app.job_title}</h3>
                        <p className="text-sm text-dim">{app.company_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-dim font-mono">{app.match_score}%</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || 'bg-surface-3 text-dim border border-bdim'}`}>
                          {app.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {app.cover_message && (
                      <p className="text-sm text-dim mt-2 line-clamp-2">{app.cover_message}</p>
                    )}
                    <button
                      onClick={() => loadMessages(app.id)}
                      className="text-sm text-accent hover:underline underline-offset-4 mt-2"
                    >
                      {selectedConversation === app.id ? 'Hide Conversation' : 'View Conversation'}
                    </button>
                    {selectedConversation === app.id && messages.length > 0 && (
                      <div className="mt-3 border-t border-bdim pt-3 space-y-2">
                        {messages.map(msg => (
                          <div
                            key={msg.id}
                            className={`text-sm p-3 rounded-lg border ${msgColors[msg.sender_type] || 'bg-surface-3 border-bdim'}`}
                          >
                            <span className="font-medium text-white capitalize">{msg.sender_type}:</span>{' '}
                            <span className="text-dim">{msg.content}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
