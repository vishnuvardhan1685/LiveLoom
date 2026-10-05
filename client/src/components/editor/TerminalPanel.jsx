export function TerminalPanel({ lines, collapsed, onToggle, height }) {
  return (
    <div
      className="terminal-panel flex flex-col bg-surface-container-lowest border-t border-surface-variant flex-shrink-0 font-mono text-xs select-none"
      style={{ height: collapsed ? '28px' : `${height}px` }}
    >
      {/* Terminal Tab Bar Header */}
      <div
        className="h-7 px-3 bg-surface-container-low border-b border-surface-variant flex items-center justify-between flex-shrink-0 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="font-label-sm text-[10px] uppercase tracking-wider font-bold text-tertiary">
            SESSION LOG
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button className="text-outline hover:text-on-surface" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-[14px]">
              {collapsed ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            </span>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-0 bg-surface-container-lowest p-2 font-mono text-xs overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed">
            {lines.length === 0 ? (
              <div className="text-outline italic">No session events yet.</div>
            ) : (
              lines.map((l, i) => (
                <div key={i} className={`terminal-line ${l.type} font-mono text-[11px]`}>
                  [{new Date().toLocaleTimeString()}] {l.text}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}