const STATUS_LABEL = {
  pending: 'Queued', uploading: 'Reading…', done: 'Added',
  error: 'Failed', 'skipped-binary': 'Skipped (binary)',
}
const STATUS_COLOR = {
  pending: 'var(--text-muted)', uploading: 'var(--accent)', done: '#22c55e',
  error: '#ef4444', 'skipped-binary': 'var(--text-muted)',
}

export function UploadProgressToast({ uploads, onDismiss }) {
  if (!uploads.length) return null
  const allSettled = uploads.every((u) => u.status !== 'pending' && u.status !== 'uploading')

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', bottom: 16, right: 16, width: 300,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 6, padding: 12, zIndex: 50,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-secondary)' }}>
          {uploads.length} file{uploads.length > 1 ? 's' : ''}
        </span>
        {allSettled && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
            Dismiss
          </button>
        )}
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {uploads.map((u) => (
          <div key={u.relativePath} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.relativePath}
            </span>
            <span style={{ color: STATUS_COLOR[u.status], marginLeft: 8, flexShrink: 0 }}>
              {STATUS_LABEL[u.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}