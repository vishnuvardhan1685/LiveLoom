export function EditorTabs({ tabs, activeTabId, setActiveTab, closeTab }) {
  return (
    <div className="flex items-stretch h-8 bg-surface-container-lowest overflow-x-auto select-none border-b border-surface-variant flex-shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-3 bg-surface-container text-on-surface cursor-pointer min-w-[130px] justify-between border-r border-surface-variant font-mono text-xs transition-colors ${
              isActive ? 'bg-surface-container font-bold text-on-surface' : 'bg-surface-container-lowest text-outline hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            {/* Active Dual-thread top decoration line */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[2px] flex">
                <div className="h-full flex-1 bg-primary" />
                <div className="h-full w-2 bg-tertiary" />
                <div className="h-full w-2 bg-primary-container" />
                <div className="h-full flex-1 bg-primary" />
              </div>
            )}

            <div className="flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-[13px] text-secondary">code_blocks</span>
              <span className="truncate">{tab.name}{tab.isDirty ? ' •' : ''}</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="text-outline hover:text-on-surface transition-colors p-0.5"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}