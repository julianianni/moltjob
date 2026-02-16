import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import type { AuthPayload } from './types'

interface AuthState {
  token: string | null
  user: AuthPayload | null
  loading: boolean
}

export function useAuth() {
  const router = useRouter()
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    user: null,
    loading: true,
  })
  const logoutRef = useRef<(() => void) | undefined>(undefined)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuth({ token: null, user: null, loading: false })
    router.replace('/login')
  }, [router])

  logoutRef.current = logout

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthPayload
        setAuth({ token, user, loading: false })

        // Validate token with server
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(res => {
          if (res.status === 401) {
            logoutRef.current?.()
          }
        }).catch(() => {})
      } catch {
        setAuth({ token: null, user: null, loading: false })
      }
    } else {
      setAuth({ token: null, user: null, loading: false })
    }
  }, [])

  const login = useCallback((token: string, user: AuthPayload) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setAuth({ token, user, loading: false })
  }, [])

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
          ...options.headers,
        },
      })
      if (res.status === 401) {
        logoutRef.current?.()
      }
      return res
    },
    [auth.token]
  )

  return { ...auth, login, logout, fetchWithAuth }
}
