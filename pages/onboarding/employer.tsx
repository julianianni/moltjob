import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

function ChatOnboarding({ fetchWithAuth, onFallback }: {
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>
  onFallback: () => void
}) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [readyForCompletion, setReadyForCompletion] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    let cancelled = false
    async function startSession() {
      try {
        const res = await fetchWithAuth('/api/v1/onboarding/sessions', {
          method: 'POST',
          body: JSON.stringify({ agent_type: 'employer' }),
        })
        if (!res.ok) {
          onFallback()
          return
        }
        const data = await res.json()
        if (cancelled) return
        setSessionId(data.session_id)
        if (data.greeting) {
          setMessages([{ id: 'greeting', role: 'assistant', content: data.greeting }])
        }
        if (data.completion_progress != null) setProgress(data.completion_progress)
        if (data.ready_for_completion) setReadyForCompletion(true)
      } catch {
        if (!cancelled) onFallback()
      }
    }
    startSession()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setError('')

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetchWithAuth(`/api/v1/onboarding/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        setError('Failed to send message. Try again.')
        setSending(false)
        return
      }
      const data = await res.json()
      if (data.content) {
        setMessages(prev => [...prev, { id: data.message_id || `asst-${Date.now()}`, role: 'assistant', content: data.content }])
      }
      if (data.completion_progress != null) setProgress(data.completion_progress)
      if (data.ready_for_completion) setReadyForCompletion(true)
    } catch {
      setError('Connection error. Try again.')
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleComplete = async () => {
    if (!sessionId || completing) return
    setCompleting(true)
    setError('')
    try {
      const res = await fetchWithAuth(`/api/v1/onboarding/sessions/${sessionId}/complete`, {
        method: 'POST',
      })
      if (!res.ok) {
        setError('Failed to complete setup. Try again.')
        setCompleting(false)
        return
      }
      router.push('/dashboard/employer')
    } catch {
      setError('Connection error. Try again.')
      setCompleting(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-4">
        <div className="flex justify-between text-xs text-dim mb-1.5">
          <span>Company setup</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] text-sm p-3 rounded-lg border ${
              msg.role === 'assistant'
                ? 'bg-accent/10 border-accent/10 text-white'
                : 'bg-surface-3 border-bdim text-dim'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="text-sm p-3 rounded-lg border bg-accent/10 border-accent/10 text-dim">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg mb-3 text-sm">{error}</div>
      )}

      {readyForCompletion && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="w-full py-3 mb-3 bg-accent text-surface font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {completing ? 'Setting up your agent...' : 'Complete Setup'}
        </button>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="Type your response..."
          disabled={sending}
          className="flex-1 px-4 py-2.5 bg-surface border border-bdim rounded-lg text-white text-sm placeholder-dim/50 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="px-5 py-2.5 bg-accent text-surface rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  )
}

function FormOnboarding({ fetchWithAuth }: {
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: '',
    company_description: '',
    industry: '',
    company_size: 'small',
    website: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    </>
  )
}

export default function EmployerOnboarding() {
  const router = useRouter()
  const { fetchWithAuth, user, loading: authLoading } = useAuth()
  const [useFallback, setUseFallback] = useState(false)

  if (authLoading) return null
  if (!user || user.role !== 'employer') {
    router.replace('/')
    return null
  }

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
            {useFallback
              ? 'Set up your company profile to start posting jobs for free.'
              : 'Chat with our onboarding agent to set up your company profile.'}
          </p>

          {useFallback
            ? <FormOnboarding fetchWithAuth={fetchWithAuth} />
            : <ChatOnboarding fetchWithAuth={fetchWithAuth} onFallback={() => setUseFallback(true)} />
          }
        </div>
      </div>
    </>
  )
}
