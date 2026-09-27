function Node({ node, depth, expandedDirs, toggleDir, openFile, activePath }) {
  if (node.type === 'directory') {
    const isOpen = expandedDirs.has(node.path)
    return (
      <div>
        <div className="file-tree-item" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => toggleDir(node.path)}>
          <span style={{ fontSize: 10, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}>▸</span>
          {node.name}
        </div>
        {isOpen && node.children.map((child) => (
          <Node key={child.id} node={child} depth={depth + 1} expandedDirs={expandedDirs} toggleDir={toggleDir} openFile={openFile} activePath={activePath} />
        ))}
      </div>
    )
  }
  return (
    <div
      className={`file-tree-item${node.path === activePath ? ' active' : ''}`}
      style={{ paddingLeft: 8 + depth * 12 + 14 }}
      onClick={() => openFile(node)}
    >
      {node.name}
    </div>
  )
}

export function SidebarFileTree({ tree, expandedDirs, toggleDir, openFile, activePath }) {
  return (
    <aside style={{ width: 'var(--sidebar-width)', flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', overflowY: 'auto', padding: '8px 0' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '4px 12px 8px', fontFamily: "'JetBrains Mono',monospace" }}>
        FILES
      </div>
      {tree.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 12px' }}>No files yet — drop some in.</p>
      ) : (
        tree.map((node) => (
          <Node key={node.id} node={node} depth={0} expandedDirs={expandedDirs} toggleDir={toggleDir} openFile={openFile} activePath={activePath} />
        ))
      )}
    </aside>
  )
}