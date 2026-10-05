export function StatusBar({ language, line, column, syncStatus, activePeersCount }) {
  const syncLabel =
    syncStatus === 'synced'  ? 'SYNCED'   :
    syncStatus === 'syncing' ? 'SYNCING…' : 'OFFLINE'

  const syncColor =
    syncStatus === 'synced'  ? 'text-tertiary'  :
    syncStatus === 'syncing' ? 'text-secondary' : 'text-error'

  return (
    <footer className="h-6 bg-surface-container-lowest border-t border-surface-variant px-3 flex items-center justify-between font-mono text-[10px] text-outline select-none flex-shrink-0 z-40">
      {/* Left: CRDT sync status & peer count */}
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1 ${syncColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            syncStatus === 'synced'  ? 'bg-tertiary animate-pulse' :
            syncStatus === 'syncing' ? 'bg-secondary animate-spin' : 'bg-error'
          }`} />
          CRDT {syncLabel}
        </span>
        <span className="flex items-center gap-1 text-outline">
          <span className="material-symbols-outlined text-[13px]">group</span>
          {activePeersCount ?? 0} {activePeersCount === 1 ? 'PEER' : 'PEERS'}
        </span>
      </div>

      {/* Right: language, encoding & cursor */}
      <div className="flex items-center gap-3">
        <span>{language ? language.toUpperCase() : 'PLAINTEXT'}</span>
        <span>UTF-8</span>
        <span>LN {line}, COL {column}</span>
      </div>
    </footer>
  )
}