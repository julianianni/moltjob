import { useState, useEffect, useCallback } from 'react'
import type { AuthPayload } from './types'

interface AuthState {
  token: string | null
  user: AuthPayload | null
  loading: boolean
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    user: null,
    loading: true,
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthPayload
        setAuth({ token, user, loading: false })
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

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuth({ token: null, user: null, loading: false })
  }, [])

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
          ...options.headers,
        },
      })
    },
    [auth.token]
  )

  return { ...auth, login, logout, fetchWithAuth }
}
