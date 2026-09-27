export function TerminalPanel({ lines, collapsed, onToggle }) {
  return (
    <div className="terminal-panel" style={{ height: collapsed ? 28 : 'var(--terminal-height)' }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)' }}
      >
        <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>ACTIVITY</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{collapsed ? '▴' : '▾'}</span>
      </div>
      {!collapsed && (
        <div style={{ overflowY: 'auto', height: 'calc(100% - 28px)' }}>
          {lines.map((l, i) => (
            <div key={i} className={`terminal-line ${l.type}`}>{l.text}</div>
          ))}
        </div>
      )}
    </div>
  )
}