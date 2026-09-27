import { initialsFor } from '@/lib/collabColors'

export function PresenceAvatarStack({ collaborators }) {
  if (!collaborators.length) return null
  const visible = collaborators.slice(0, 5)
  const overflow = collaborators.length - visible.length

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((c, i) => (
        <div
          key={c.userId}
          data-tooltip={c.name}
          className="avatar-ring"
          style={{
            width: 24, height: 24, borderColor: c.color, background: c.color,
            color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, marginLeft: i > 0 ? -6 : 0,
            position: 'relative', zIndex: visible.length - i, boxShadow: '0 0 0 2px var(--bg-base)',
          }}
        >
          {initialsFor(c.name)}
        </div>
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: "'JetBrains Mono',monospace" }}>
          +{overflow}
        </span>
      )}
    </div>
  )
}