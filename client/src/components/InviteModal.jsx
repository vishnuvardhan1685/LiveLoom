import { useState } from 'react'
import { roomsApi } from '@/lib/api'

export function InviteModal({ roomId, onClose }) {
  const [role, setRole] = useState('editor')
  const [expiresIn, setExpiresIn] = useState('24') // hours
  const [maxUses, setMaxUses] = useState('10')
  const [result, setResult] = useState(null) // { token, link }
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const expiresAt = new Date(Date.now() + Number(expiresIn) * 3_600_000).toISOString()
    try {
      const { data } = await roomsApi.createInvite(roomId, role, expiresAt, Number(maxUses))
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create invite token.')
    } finally {
      setBusy(false)
    }
  }

  const inviteUrl = result
    ? `${window.location.origin}/join/${result.token}`
    : null

  const handleCopyCode = () => {
    if (!result?.token) return
    navigator.clipboard.writeText(result.token)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#121315', border: '1px solid #343537',
        borderRadius: 0, padding: 24, width: '100%', maxWidth: 440,
        boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #343537', pb: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined text-primary text-[20px]">vpn_key</span>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e3e2e4' }}>Invite to Room</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aa888a', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(147,0,10,0.3)', border: '1px solid #93000a', color: '#ffb4ab', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>
            {error}
          </div>
        )}

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: '#e3bdbf', margin: 0, fontFamily: "'Space Mono', monospace" }}>
              Invite created! Grants <strong style={{ color: '#4edea3' }}>{result.role.toUpperCase()}</strong> access ({expiresIn}h, max {maxUses} uses).
            </p>

            {/* PRIMARY: Invite Code Copy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#aa888a', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', fontWeight: 700 }}>
                INVITE CODE (RAW TOKEN)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  readOnly
                  value={result.token}
                  className="ll-input"
                  style={{ fontSize: 12, padding: '8px 10px', background: '#0d0e10', color: '#ffb2b7', fontWeight: 700, letterSpacing: '0.05em' }}
                  onFocus={(e) => e.target.select()}
                />
                <button onClick={handleCopyCode} className="ll-btn ll-btn-primary" style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}>
                  {copiedCode ? 'COPIED CODE!' : 'COPY CODE'}
                </button>
              </div>
            </div>

            {/* SECONDARY: Full URL Copy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#aa888a', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>
                FULL JOIN LINK
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  readOnly
                  value={inviteUrl}
                  className="ll-input"
                  style={{ fontSize: 11, padding: '6px 10px', background: '#1b1c1e', color: '#aa888a' }}
                  onFocus={(e) => e.target.select()}
                />
                <button onClick={handleCopyLink} className="ll-btn ll-btn-ghost" style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0 }}>
                  {copiedLink ? 'COPIED LINK!' : 'COPY LINK'}
                </button>
              </div>
            </div>

            <button onClick={() => setResult(null)} className="ll-btn ll-btn-ghost" style={{ fontSize: 12, marginTop: 4 }}>
              Generate Another Token
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#aa888a', display: 'block', marginBottom: 5, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="ll-input"
                style={{ fontSize: 13, background: '#1b1c1e' }}
              >
                <option value="editor">Editor — Read & Write</option>
                <option value="viewer">Viewer — Read Only</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#aa888a', display: 'block', marginBottom: 5, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>Expires In (Hours)</label>
              <input
                type="number"
                min="1" max="720"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="ll-input"
                style={{ fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#aa888a', display: 'block', marginBottom: 5, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>Max Uses</label>
              <input
                type="number"
                min="1" max="1000"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="ll-input"
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={onClose} className="ll-btn ll-btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
              <button type="submit" disabled={busy} className="ll-btn ll-btn-primary" style={{ fontSize: 12 }}>
                {busy ? 'GENERATING…' : 'GENERATE TOKEN'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
