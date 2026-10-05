import { useState, useCallback, useEffect } from 'react'
import { authApi } from '@/lib/api'

// ─── Storage keys ─────────────────────────────────────────────────────────────
// Server returns { token, user: { id, email, name } }
// We store the token as 'll_token' and the user object as 'll_user'
const TOKEN_KEY = 'll_token'
const USER_KEY  = 'll_user'

function loadPersistedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const [user,      setUser]      = useState(loadPersistedUser)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState(null)

  const isAuthenticated = !!user

  /** Persist token + normalized user object to localStorage and state. */
  const persist = useCallback((token, serverUser) => {
    // serverUser shape from server: { id, email, name }
    // We normalize to { id, email, name } for consistent use across the app
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(serverUser))
    setUser(serverUser)
  }, [])

  /** POST /auth/login — body: { email, password } */
  const login = useCallback(async (email, password) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await authApi.login(email, password)
      // Server response: { token, user: { id, email, name } }
      persist(data.token, data.user)
    } catch (err) {
      const msg = err.response?.data?.error ?? err.response?.data?.message ?? 'Login failed.'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [persist])

  /** POST /auth/signup — body: { email, password, name } */
  const signup = useCallback(async (email, password, name) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await authApi.signup(email, password, name)
      persist(data.token, data.user)
    } catch (err) {
      const msg = err.response?.data?.error ?? err.response?.data?.message ?? 'Signup failed.'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [persist])

  const updateProfile = useCallback(async (dataToUpdate) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await authApi.updateMe(dataToUpdate)
      if (data.token && data.user) {
        persist(data.token, data.user)
      } else if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        setUser(data.user)
      }
      return data.user
    } catch (err) {
      const msg = err.response?.data?.error ?? err.response?.data?.message ?? 'Failed to update profile.'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [persist])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { user, isLoading, error, isAuthenticated, login, signup, updateProfile, logout, clearError }
}
