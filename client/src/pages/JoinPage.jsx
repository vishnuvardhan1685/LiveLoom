import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invitesApi } from '@/lib/api'
import { useAuthContext } from '@/app/providers/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { toast } from '@/components/Toast'

/**
 * GET /invites/:token → { roomId, role }
 * If the user isn't logged in, redirect to /login with a returnTo param,
 * so after auth they land back here and the redemption runs.
 */
export function JoinPage() {
  useDocumentTitle('Join Room')
  const { token } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthContext()

  const [status, setStatus] = useState('Redeeming invite…')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?returnTo=/join/${token}`, { replace: true })
      return
    }

    let cancelled = false
    invitesApi.redeem(token)
      .then(({ data }) => {
        if (cancelled) return
        setStatus(`Joined! Role: ${data.role}. Redirecting…`)
        setTimeout(() => navigate(`/room/${data.roomId}`, { replace: true }), 800)
      })
      .catch((err) => {
        if (cancelled) return
        const status = err.response?.status
        if (status === 410) {
          setError('This invite link has expired or has been fully used.')
        } else if (status === 404) {
          setError('Invite link not found.')
        } else {
          setError(err.response?.data?.error ?? 'Failed to redeem invite.')
        }
      })

    return () => { cancelled = true }
  }, [token, isAuthenticated, navigate])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>LIVELOOM</span>
      {error ? (
        <>
          <p style={{ fontSize: 14, color: '#f87171', textAlign: 'center', maxWidth: 320 }}>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="ll-btn ll-btn-ghost" style={{ fontSize: 13 }}>← Dashboard</button>
        </>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{status}</p>
      )}
    </div>
  )
}
