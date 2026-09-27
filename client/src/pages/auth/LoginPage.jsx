import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthLayout }    from '@/components/auth/AuthLayout'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useAuthContext } from '@/app/providers/AuthProvider'

export function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthContext()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      // error already set in useAuth
    }
  }

  return (
    <AuthLayout>
      <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' }}>Sign in</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px' }}>Welcome back.</p>

      {error && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, fontSize: 13, color: '#f87171' }}>
          {error}
        </div>
      )}

      <form id="login-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          id="login-email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ll-input"
          required
          autoComplete="email"
        />
        <PasswordInput
          id="login-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>

        <button id="login-submit" type="submit" disabled={isLoading} className="ll-btn ll-btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}/>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity: 0.75 }}/>
              </svg>
              Signing in…
            </span>
          ) : 'Sign in'}
        </button>
      </form>

      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 28, textAlign: 'center' }}>
        No account?{' '}
        <Link to="/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Create one</Link>
      </p>
    </AuthLayout>
  )
}
