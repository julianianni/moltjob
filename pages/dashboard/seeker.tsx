import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/useAuth'
import type {
  JobSeeker,
  Application,
  Message,
  ApiKey,
  ActivityLogEntry,
} from '@/lib/types'

export default function SeekerDashboard() {
  const router = useRouter()
  const { user, loading: authLoading, fetchWithAuth, logout } = useAuth()

  const [profile, setProfile] = useState<JobSeeker | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null)
  const [messages, setMessages] = useState<Message[]>([])

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
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (!authLoading && user?.role !== 'job_seeker') {
      router.replace('/dashboard/employer')
      return
    }
    if (!authLoading && user) {
      loadProfile()
      loadApplications()
      loadApiKeys()
      loadActivity()
    }
  }, [
    authLoading,
    user,
    router,
    loadProfile,
    loadApplications,
    loadApiKeys,
    loadActivity,
  ])

  // Refresh activity every 30s
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

  const toggleAgent = async () => {
    const res = await fetchWithAuth('/api/agent/toggle', { method: 'POST' })
    if (res.ok) loadProfile()
  }

  const loadMessages = async (applicationId: string) => {
    const res = await fetchWithAuth(`/api/messages/${applicationId}`)
    if (res.ok) {
      setMessages(await res.json())
      setSelectedConversation(applicationId)
    }
  }

  if (authLoading || !profile) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-pulse text-lg'>Loading...</div>
      </div>
    )
  }

  const agentConnected = apiKeys.some(
    (k) =>
      !k.revoked_at &&
      k.last_used_at &&
      Date.now() - new Date(k.last_used_at).getTime() < 5 * 60 * 1000,
  )

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewing: 'bg-blue-100 text-blue-800',
    shortlisted: 'bg-green-100 text-green-800',
    interview_scheduled: 'bg-purple-100 text-purple-800',
    rejected: 'bg-red-100 text-red-800',
    accepted: 'bg-emerald-100 text-emerald-800',
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <nav className='bg-white shadow-sm'>
        <div className='max-w-6xl mx-auto px-4 py-4 flex justify-between items-center'>
          <h1 className='text-xl font-bold'>MoltJob</h1>
          <div className='flex items-center gap-4'>
            <span className='text-sm text-gray-600'>{profile.full_name}</span>
            <button
              onClick={logout}
              className='text-sm text-gray-500 hover:text-gray-700'
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className='max-w-6xl mx-auto px-4 py-8 space-y-6'>
        {/* API Keys */}
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <div className='flex justify-between items-center mb-4'>
            <div className='flex items-center gap-3'>
              <h2 className='text-lg font-semibold'>API Keys</h2>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${agentConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${agentConnected ? 'bg-green-500' : 'bg-gray-400'}`}
                />
                {agentConnected ? 'Agent Connected' : 'Agent Offline'}
              </span>
            </div>
          </div>

          <p className='text-sm text-gray-600 mb-4'>
            Give your API key to your AI agent so it can connect to MoltJob.
            Read the instructions at{' '}
            <code className='bg-gray-100 px-1 py-0.5 rounded text-xs'>
              /api/v1/skill.md
            </code>
          </p>

          {newKeyRaw && (
            <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4'>
              <p className='text-sm font-medium text-yellow-800 mb-2'>
                Copy this key now — it won&apos;t be shown again:
              </p>
              <code className='block bg-white border border-yellow-300 rounded p-2 text-sm break-all font-mono'>
                {newKeyRaw}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKeyRaw)
                  setNewKeyRaw(null)
                }}
                className='mt-2 text-sm text-yellow-700 hover:underline'
              >
                Copy & Dismiss
              </button>
            </div>
          )}

          <div className='flex gap-2 mb-4'>
            <input
              type='text'
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder='Key name (e.g. My Claude Agent)'
              className='flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <button
              onClick={generateApiKey}
              className='px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700'
            >
              Generate Key
            </button>
          </div>

          {apiKeys.length > 0 && (
            <div className='space-y-2'>
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className='flex items-center justify-between py-2 border-b border-gray-100 last:border-0'
                >
                  <div>
                    <span className='font-mono text-sm'>
                      {key.key_prefix}...
                    </span>
                    <span className='text-sm text-gray-500 ml-2'>
                      {key.name}
                    </span>
                    {key.last_used_at && (
                      <span className='text-xs text-gray-400 ml-2'>
                        Last used: {new Date(key.last_used_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {!key.revoked_at ? (
                    <button
                      onClick={() => revokeKey(key.id)}
                      className='text-xs text-red-600 hover:underline'
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className='text-xs text-gray-400'>Revoked</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Status */}
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <div className='flex justify-between items-center'>
            <div>
              <h2 className='text-lg font-semibold'>Agent Status</h2>
              <p className='text-gray-600 text-sm mt-1'>
                {profile.agent_active
                  ? `Active — ${profile.applications_today}/3 applications today`
                  : 'Paused — your agent will not apply to jobs'}
              </p>
            </div>
            <button
              onClick={toggleAgent}
              className={`px-4 py-2 rounded-lg font-medium ${
                profile.agent_active
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {profile.agent_active ? 'Pause Agent' : 'Resume Agent'}
            </button>
          </div>
        </div>

        {/* Profile Summary */}
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <h2 className='text-lg font-semibold mb-3'>Your Profile</h2>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
            <div>
              <span className='text-gray-500'>Skills</span>
              <p className='font-medium'>
                {profile.skills.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <span className='text-gray-500'>Experience</span>
              <p className='font-medium'>{profile.experience_years} years</p>
            </div>
            <div>
              <span className='text-gray-500'>Salary Range</span>
              <p className='font-medium'>
                {profile.min_salary && profile.max_salary
                  ? `$${profile.min_salary.toLocaleString()} - $${profile.max_salary.toLocaleString()}`
                  : 'Not set'}
              </p>
            </div>
            <div>
              <span className='text-gray-500'>Remote</span>
              <p className='font-medium capitalize'>
                {profile.remote_preference}
              </p>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <h2 className='text-lg font-semibold mb-4'>Agent Activity</h2>
          {activity.length === 0 ? (
            <p className='text-gray-500 text-sm text-center py-4'>
              No activity yet. Connect your agent using an API key to get
              started.
            </p>
          ) : (
            <div className='space-y-2'>
              {activity.map((entry) => (
                <div
                  key={entry.id}
                  className='flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-sm'
                >
                  <div>
                    <span className='font-medium'>
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    {entry.resource_type && (
                      <span className='text-gray-500 ml-1'>
                        ({entry.resource_type})
                      </span>
                    )}
                  </div>
                  <span className='text-xs text-gray-400'>
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Applications */}
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <h2 className='text-lg font-semibold mb-4'>
            Applications ({applications.length})
          </h2>
          {applications.length === 0 ? (
            <p className='text-gray-500 text-center py-8'>
              No applications yet. Your agent will apply automatically once
              connected.
            </p>
          ) : (
            <div className='space-y-3'>
              {applications.map((app) => (
                <div
                  key={app.id}
                  className='border border-gray-200 rounded-lg p-4'
                >
                  <div className='flex justify-between items-start'>
                    <div>
                      <h3 className='font-medium'>{app.job_title}</h3>
                      <p className='text-sm text-gray-600'>
                        {app.company_name}
                      </p>
                    </div>
                    <div className='flex items-center gap-3'>
                      <span className='text-sm text-gray-500'>
                        Match: {app.match_score}%
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[app.status] || 'bg-gray-100 text-gray-800'}`}
                      >
                        {app.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  {app.cover_message && (
                    <p className='text-sm text-gray-600 mt-2 line-clamp-2'>
                      {app.cover_message}
                    </p>
                  )}
                  <button
                    onClick={() => loadMessages(app.id)}
                    className='text-sm text-blue-600 hover:underline mt-2'
                  >
                    View Conversation
                  </button>
                  {selectedConversation === app.id && messages.length > 0 && (
                    <div className='mt-3 border-t pt-3 space-y-2'>
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`text-sm p-2 rounded ${
                            msg.sender_type === 'agent'
                              ? 'bg-blue-50'
                              : msg.sender_type === 'employer'
                                ? 'bg-gray-50'
                                : 'bg-yellow-50'
                          }`}
                        >
                          <span className='font-medium capitalize'>
                            {msg.sender_type}:
                          </span>{' '}
                          {msg.content}
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
  )
}
