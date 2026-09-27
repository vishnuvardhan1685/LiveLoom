import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomsApi, invitesApi } from '@/lib/api'
import { useAuthContext } from '@/app/providers/AuthProvider'

const RECENTS_KEY = 'll_recent_rooms'

function loadRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) ?? [] } catch { return [] }
}
function saveRecent(room) {
  const recents = loadRecents().filter((r) => r.id !== room.id)
  const next = [room, ...recents].slice(0, 10)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  return next
}

export function DashboardPage() {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const [recents, setRecents] = useState(loadRecents)
  const [roomName, setRoomName] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!roomName.trim()) return
    setBusy(true); setError(null)
    try {
      const { data } = await roomsApi.create(roomName.trim())
      setRecents(saveRecent({ id: data.id, name: data.name }))
      navigate(`/room/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not create room.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!inviteToken.trim()) return
    setBusy(true); setError(null)
    try {
      const { data } = await invitesApi.redeem(inviteToken.trim())
      navigate(`/room/${data.roomId}`)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Invalid or expired invite.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>LIVELOOM</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user?.name ?? user?.email}</span>
          <button onClick={logout} className="ll-btn ll-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Sign out</button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        {error && (
          <div style={{ marginBottom: 20, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, fontSize: 13, color: '#f87171' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
          <form onSubmit={handleCreate} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>New room</h3>
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Room name" className="ll-input" />
            <button type="submit" disabled={busy} className="ll-btn ll-btn-primary" style={{ width: '100%', marginTop: 10 }}>Create</button>
          </form>

          <form onSubmit={handleJoin} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>Join with invite</h3>
            <input value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} placeholder="Invite token" className="ll-input" />
            <button type="submit" disabled={busy} className="ll-btn ll-btn-ghost" style={{ width: '100%', marginTop: 10 }}>Join</button>
          </form>
        </div>

        <h3 style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>RECENT ROOMS</h3>
        {recents.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No rooms yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {recents.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/room/${r.id}`)}
                style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
              >
                {r.name}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}