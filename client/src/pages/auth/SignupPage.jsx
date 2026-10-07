import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AuthLayout }    from '@/components/auth/AuthLayout'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useAuthContext } from '@/app/providers/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function SignupPage() {
  useDocumentTitle('Create account')
  const { signup, isLoading, error, clearError } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  const params   = new URLSearchParams(location.search)
  const returnTo = params.get('returnTo') ?? '/dashboard'

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    clearError()
    try {
      await signup(email, password, name)
      navigate(returnTo, { replace: true })
    } catch {
      // error already set in useAuth
    }
  }

  return (
    <AuthLayout>
      <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' }}>Create account</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px' }}>Start collaborating in seconds.</p>

      {error && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, fontSize: 13, color: '#f87171' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="ll-input" required autoComplete="name" />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="ll-input" required autoComplete="email" />
        <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />

        <button type="submit" disabled={isLoading} className="ll-btn ll-btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 28, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
      </p>
    </AuthLayout>
  )
}