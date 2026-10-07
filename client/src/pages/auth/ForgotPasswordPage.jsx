import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function ForgotPasswordPage() {
  useDocumentTitle('Reset Password')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <AuthLayout>
      <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' }}>Reset Password</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px' }}>
        Enter your email address to receive password reset instructions.
      </p>

      {submitted ? (
        <div style={{ padding: '16px', background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.3)', borderRadius: 6, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, margin: '0 0 12px' }}>
            If an account exists for <strong>{email}</strong>, reset instructions have been sent.
          </p>
          <Link to="/login" className="ll-btn ll-btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </div>
      ) : (
        <form id="forgot-password-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            id="forgot-email"
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ll-input"
            required
            autoComplete="email"
          />

          <button id="forgot-submit" type="submit" className="ll-btn ll-btn-primary" style={{ width: '100%' }}>
            Send Reset Instructions
          </button>
        </form>
      )}

      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 28, textAlign: 'center' }}>
        Remember your password?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
      </p>
    </AuthLayout>
  )
}
