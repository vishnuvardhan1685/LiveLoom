import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomsApi, invitesApi } from '@/lib/api'
import { useAuthContext } from '@/app/providers/AuthProvider'
import { ProfileModal } from '@/components/ProfileModal'

export function DashboardPage() {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const [rooms,        setRooms]        = useState([])
  const [roomsLoading, setRoomsLoading]  = useState(true)
  const [roomName,     setRoomName]     = useState('')
  const [inviteToken,  setInviteToken]  = useState('')
  const [error,        setError]        = useState(null)
  const [busy,         setBusy]         = useState(false)
  const [profileOpen,  setProfileOpen]  = useState(false)

  // Load the user's rooms from the server on mount
  useEffect(() => {
    let cancelled = false
    roomsApi.list()
      .then(({ data }) => {
        if (!cancelled) setRooms(data)
      })
      .catch(() => {
        // Silent — recents still work if the request fails
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!roomName.trim()) return
    setBusy(true); setError(null)
    try {
      const { data } = await roomsApi.create(roomName.trim())
      setRooms((prev) => [{ id: data.id, name: data.name, role: data.role, memberCount: 1 }, ...prev])
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
      const status = err.response?.status
      if (status === 410) {
        setError('Invite link has expired or been fully used.')
      } else if (status === 404) {
        setError('Invite link not found.')
      } else {
        setError(err.response?.data?.error ?? 'Invalid or expired invite.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const ROLE_COLOR = { owner: '#7c6af7', editor: '#34d399', viewer: '#f59e0b' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>LIVELOOM</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setProfileOpen(true)}
            className="ll-btn ll-btn-ghost"
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
            {user?.name ?? user?.email}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        {error && (
          <div style={{ marginBottom: 20, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, fontSize: 13, color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Create / Join row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
          <form onSubmit={handleCreate} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>New room</h3>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name"
              className="ll-input"
            />
            <button type="submit" disabled={busy} className="ll-btn ll-btn-primary" style={{ width: '100%', marginTop: 10 }}>
              Create
            </button>
          </form>

          <form onSubmit={handleJoin} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>Join with invite</h3>
            <input
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="Invite token or paste full link"
              className="ll-input"
            />
            <button type="submit" disabled={busy} className="ll-btn ll-btn-ghost" style={{ width: '100%', marginTop: 10 }}>
              Join
            </button>
          </form>
        </div>

        {/* Rooms list */}
        <h3 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>MY ROOMS</h3>
        {roomsLoading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
        ) : rooms.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No rooms yet — create or join one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rooms.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/room/${r.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '1px solid var(--border)', borderRadius: 4,
                  cursor: 'pointer', fontSize: 13,
                  transition: 'background 0.1s, border-color 0.1s',
                  background: 'var(--bg-surface)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {r.memberCount != null && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.memberCount} member{r.memberCount !== 1 ? 's' : ''}</span>
                  )}
                  <span style={{
                    fontSize: 11, padding: '1px 7px', borderRadius: 3,
                    background: `${ROLE_COLOR[r.role] ?? '#555'}22`,
                    color: ROLE_COLOR[r.role] ?? 'var(--text-muted)',
                    border: `1px solid ${ROLE_COLOR[r.role] ?? '#555'}44`,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {r.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  )
}