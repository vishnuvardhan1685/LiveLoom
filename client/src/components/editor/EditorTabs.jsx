export function EditorTabs({ tabs, activeTabId, setActiveTab, closeTab }) {
  return (
    <div style={{ display: 'flex', overflowX: 'auto', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      {tabs.map((tab) => (
        <div key={tab.id} className={`editor-tab${tab.id === activeTabId ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
          <span>{tab.name}{tab.isDirty ? ' •' : ''}</span>
          <span
            className="close-btn"
            onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            style={{ display: 'flex', color: 'var(--text-muted)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  )
}