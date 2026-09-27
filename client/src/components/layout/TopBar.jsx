import { useNavigate } from 'react-router-dom'
import { PresenceAvatarStack } from './PresenceAvatarStack'

const STATUS_LABEL = { synced: 'Synced', syncing: 'Syncing…', offline: 'Offline' }
const STATUS_DOT   = { synced: 'var(--status-synced)', syncing: 'var(--status-syncing)', offline: 'var(--status-offline)' }

export function TopBar({ roomName, syncStatus, collaborators, onInvite }) {
  const navigate = useNavigate()
  return (
    <header style={{ height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em' }}>
          LIVELOOM
        </button>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{roomName}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[syncStatus] }} />
          {STATUS_LABEL[syncStatus]}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <PresenceAvatarStack collaborators={collaborators} />
        <button onClick={onInvite} className="ll-btn ll-btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>
          Invite
        </button>
      </div>
    </header>
  )
}