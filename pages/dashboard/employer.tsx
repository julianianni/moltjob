import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/useAuth'
import type {
  Employer,
  JobPosting,
  Application,
  Message,
  ApiKey,
} from '@/lib/types'

export default function EmployerDashboard() {
  const router = useRouter()
  const { user, loading: authLoading, fetchWithAuth, logout } = useAuth()

  const [profile, setProfile] = useState<Employer | null>(null)
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, Message[]>
  >({})
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null)

  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    required_skills: '',
    nice_to_have_skills: '',
    location: '',
    remote_type: 'onsite',
    salary_min: '',
    salary_max: '',
    experience_min: '',
    experience_max: '',
  })

  const loadProfile = useCallback(async () => {
    const res = await fetchWithAuth('/api/employers/profile')
    if (res.ok) {
      setProfile(await res.json())
    }
  }, [fetchWithAuth])

  const loadJobs = useCallback(async () => {
    const res = await fetchWithAuth('/api/jobs')
    if (res.ok) {
      setJobs(await res.json())
    }
  }, [fetchWithAuth])

  const loadApiKeys = useCallback(async () => {
    const res = await fetchWithAuth('/api/auth/api-keys')
    if (res.ok) setApiKeys(await res.json())
  }, [fetchWithAuth])

  const loadApplications = useCallback(
    async (jobId?: string) => {
      const url = jobId
        ? `/api/applications?job_id=${jobId}`
        : '/api/applications'
      const res = await fetchWithAuth(url)
      if (res.ok) {
        setApplications(await res.json())
      }
    },
    [fetchWithAuth],
  )

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (!authLoading && user?.role !== 'employer') {
      router.replace('/dashboard/seeker')
      return
    }
    if (!authLoading && user) {
      loadProfile()
      loadJobs()
      loadApplications()
      loadApiKeys()
    }
  }, [
    authLoading,
    user,
    router,
    loadProfile,
    loadJobs,
    loadApplications,
    loadApiKeys,
  ])

  const postJob = async (e: React.FormEvent) => {
    e.preventDefault()

    const res = await fetchWithAuth('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        ...jobForm,
        required_skills: jobForm.required_skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        nice_to_have_skills: jobForm.nice_to_have_skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        salary_min: jobForm.salary_min ? parseInt(jobForm.salary_min) : null,
        salary_max: jobForm.salary_max ? parseInt(jobForm.salary_max) : null,
        experience_min: jobForm.experience_min
          ? parseInt(jobForm.experience_min)
          : 0,
        experience_max: jobForm.experience_max
          ? parseInt(jobForm.experience_max)
          : null,
      }),
    })

    if (res.ok) {
      setShowPostForm(false)
      setJobForm({
        title: '',
        description: '',
        required_skills: '',
        nice_to_have_skills: '',
        location: '',
        remote_type: 'onsite',
        salary_min: '',
        salary_max: '',
        experience_min: '',
        experience_max: '',
      })
      loadJobs()
    }
  }

  const updateStatus = async (applicationId: string, status: string) => {
    const res = await fetchWithAuth(
      `/api/applications/${applicationId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      },
    )
    if (res.ok) {
      loadApplications(selectedJob ?? undefined)
    }
  }

  const loadConversation = async (applicationId: string) => {
    const res = await fetchWithAuth(`/api/messages/${applicationId}`)
    if (res.ok) {
      const msgs = await res.json()
      setConversationMessages((prev) => ({ ...prev, [applicationId]: msgs }))
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
    await fetchWithAuth('/api/auth/api-keys', {
      method: 'DELETE',
      body: JSON.stringify({ key_id: keyId }),
    })
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
      setReplyText((prev) => ({ ...prev, [conversationId]: '' }))
      loadConversation(conversationId)
    }
  }

  if (authLoading || !profile) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-pulse text-lg'>Loading...</div>
      </div>
    )
  }

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
            <span className='text-sm text-gray-600'>
              {profile.company_name}
            </span>
            <button
              onClick={logout}
              className='text-sm text-gray-500 hover:text-gray-700'
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className='max-w-6xl mx-auto px-4 py-8'>
        {/* API Keys */}
        <div className='bg-white rounded-xl shadow-sm p-6 mb-6'>
          <h2 className='text-lg font-semibold mb-2'>API Keys</h2>
          <p className='text-sm text-gray-600 mb-4'>
            Optionally connect your own agent to manage jobs and review
            applications.
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
              placeholder='Key name'
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

        {/* Post Job Button */}
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-2xl font-bold'>Dashboard</h2>
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
          >
            {showPostForm ? 'Cancel' : 'Post a Job'}
          </button>
        </div>

        {/* Post Job Form */}
        {showPostForm && (
          <form
            onSubmit={postJob}
            className='bg-white rounded-xl shadow-sm p-6 mb-6 space-y-4'
          >
            <h3 className='text-lg font-semibold'>New Job Posting</h3>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Job Title *
              </label>
              <input
                type='text'
                required
                value={jobForm.title}
                onChange={(e) =>
                  setJobForm((f) => ({ ...f, title: e.target.value }))
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Description *
              </label>
              <textarea
                required
                rows={5}
                value={jobForm.description}
                onChange={(e) =>
                  setJobForm((f) => ({ ...f, description: e.target.value }))
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Required Skills (comma-separated)
                </label>
                <input
                  type='text'
                  placeholder='React, TypeScript...'
                  value={jobForm.required_skills}
                  onChange={(e) =>
                    setJobForm((f) => ({
                      ...f,
                      required_skills: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Nice-to-Have Skills
                </label>
                <input
                  type='text'
                  placeholder='GraphQL, Docker...'
                  value={jobForm.nice_to_have_skills}
                  onChange={(e) =>
                    setJobForm((f) => ({
                      ...f,
                      nice_to_have_skills: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Location
                </label>
                <input
                  type='text'
                  placeholder='San Francisco'
                  value={jobForm.location}
                  onChange={(e) =>
                    setJobForm((f) => ({ ...f, location: e.target.value }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Remote Type
                </label>
                <select
                  value={jobForm.remote_type}
                  onChange={(e) =>
                    setJobForm((f) => ({ ...f, remote_type: e.target.value }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='onsite'>On-site</option>
                  <option value='remote'>Remote</option>
                  <option value='hybrid'>Hybrid</option>
                </select>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Min Salary ($)
                </label>
                <input
                  type='number'
                  value={jobForm.salary_min}
                  onChange={(e) =>
                    setJobForm((f) => ({ ...f, salary_min: e.target.value }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Max Salary ($)
                </label>
                <input
                  type='number'
                  value={jobForm.salary_max}
                  onChange={(e) =>
                    setJobForm((f) => ({ ...f, salary_max: e.target.value }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Min Experience (years)
                </label>
                <input
                  type='number'
                  value={jobForm.experience_min}
                  onChange={(e) =>
                    setJobForm((f) => ({
                      ...f,
                      experience_min: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Max Experience (years)
                </label>
                <input
                  type='number'
                  value={jobForm.experience_max}
                  onChange={(e) =>
                    setJobForm((f) => ({
                      ...f,
                      experience_max: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            <button
              type='submit'
              className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
            >
              Post Job
            </button>
          </form>
        )}

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {/* Jobs List */}
          <div className='bg-white rounded-xl shadow-sm p-6'>
            <h3 className='text-lg font-semibold mb-4'>Your Jobs</h3>
            {jobs.length === 0 ? (
              <p className='text-gray-500 text-sm'>No jobs posted yet.</p>
            ) : (
              <div className='space-y-2'>
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job.id)
                      loadApplications(job.id)
                    }}
                    className={`w-full text-left p-3 rounded-lg border ${
                      selectedJob === job.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className='font-medium text-sm'>{job.title}</p>
                    <p className='text-xs text-gray-500 capitalize'>
                      {job.status}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Applications */}
          <div className='md:col-span-2 bg-white rounded-xl shadow-sm p-6'>
            <h3 className='text-lg font-semibold mb-4'>
              Applications{' '}
              {selectedJob
                ? `for ${jobs.find((j) => j.id === selectedJob)?.title}`
                : '(All)'}
            </h3>

            {applications.length === 0 ? (
              <p className='text-gray-500 text-sm'>No applications yet.</p>
            ) : (
              <div className='space-y-4'>
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className='border border-gray-200 rounded-lg p-4'
                  >
                    <div className='flex justify-between items-start mb-2'>
                      <div>
                        <h4 className='font-medium'>{app.seeker_name}</h4>
                        <p className='text-sm text-gray-500'>{app.job_title}</p>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='text-sm text-gray-500'>
                          {app.match_score}%
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statusColors[app.status] || 'bg-gray-100'
                          }`}
                        >
                          {app.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {app.cover_message && (
                      <p className='text-sm text-gray-600 mb-3'>
                        {app.cover_message}
                      </p>
                    )}

                    {/* Status Actions */}
                    <div className='flex gap-2 mb-3'>
                      <button
                        onClick={() => updateStatus(app.id, 'shortlisted')}
                        className='text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200'
                      >
                        Shortlist
                      </button>
                      <button
                        onClick={() =>
                          updateStatus(app.id, 'interview_scheduled')
                        }
                        className='text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200'
                      >
                        Schedule Interview
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'rejected')}
                        className='text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200'
                      >
                        Reject
                      </button>
                    </div>

                    {/* Conversation */}
                    <button
                      onClick={() => loadConversation(app.id)}
                      className='text-sm text-blue-600 hover:underline'
                    >
                      View / Reply
                    </button>

                    {conversationMessages[app.id] && (
                      <div className='mt-3 border-t pt-3'>
                        <div className='space-y-2 max-h-60 overflow-y-auto mb-3'>
                          {conversationMessages[app.id].map((msg) => (
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
                        <div className='flex gap-2'>
                          <input
                            type='text'
                            value={replyText[app.id] || ''}
                            onChange={(e) =>
                              setReplyText((prev) => ({
                                ...prev,
                                [app.id]: e.target.value,
                              }))
                            }
                            placeholder='Type a message...'
                            className='flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                          />
                          <button
                            onClick={() => sendMessage(app.id)}
                            className='px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700'
                          >
                            Send
                          </button>
                        </div>
                        <p className='text-xs text-gray-400 mt-1'>
                          The candidate&apos;s agent will poll and reply
                        </p>
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
  )
}
