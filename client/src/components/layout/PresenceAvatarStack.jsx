import { initialsFor } from '@/lib/collabColors'

/** Shows avatar stack for all collaborators.
 *  If a collaborator has typing:true in their awareness state, a small
 *  animated dot is shown on their avatar (spec §7: typing indicator). */
export function PresenceAvatarStack({ collaborators }) {
  if (!collaborators.length) return null
  const visible  = collaborators.slice(0, 5)
  const overflow = collaborators.length - visible.length

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((c, i) => (
        <div
          key={c.userId}
          title={c.name + (c.typing ? ' (typing…)' : '')}
          style={{ position: 'relative', marginLeft: i > 0 ? -6 : 0, zIndex: visible.length - i }}
        >
          {/* Avatar circle */}
          <div
            className="avatar-ring"
            style={{
              width: 24, height: 24,
              borderColor: c.color, background: c.color,
              color: '#0a0a0a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              boxShadow: '0 0 0 2px var(--bg-base)',
            }}
          >
            {initialsFor(c.name)}
          </div>

          {/* Typing indicator dot (spec §7) */}
          {c.typing && (
            <span
              style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 7, height: 7,
                borderRadius: '50%',
                background: '#34d399',
                border: '1.5px solid var(--bg-base)',
                animation: 'pulse 1s ease-in-out infinite',
              }}
            />
          )}
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