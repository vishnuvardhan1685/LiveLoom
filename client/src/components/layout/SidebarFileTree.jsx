import { useState } from 'react'
import { ConfirmDialog, InputDialog } from '@/components/ConfirmDialog'

function NewFileInput({ onCommit, onCancel, depth }) {
  const [value, setValue] = useState('')

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onCommit(value.trim()) }}
      className="px-2 py-1"
      style={{ paddingLeft: `${8 + depth * 12 + 14}px` }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (!value.trim()) onCancel() }}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        placeholder="filename.js"
        className="w-full bg-surface-container-high border border-primary text-on-surface text-xs font-mono px-1.5 py-0.5 outline-none"
      />
    </form>
  )
}

function Node({ node, depth, expandedDirs, toggleDir, openFile, activePath, onDeleteFile, onRenameFile, collaborators, onRenameRequest, onDeleteRequest }) {
  if (node.type === 'directory') {
    const isOpen = expandedDirs.has(node.path)
    return (
      <div>
        <div
          className="flex items-center h-6 px-2 text-on-surface cursor-pointer hover:bg-surface-container-low text-xs font-mono"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => toggleDir(node.path)}
        >
          <span className="material-symbols-outlined text-[14px] text-outline mr-1.5">
            {isOpen ? 'folder_open' : 'folder'}
          </span>
          <span className="font-bold text-on-surface truncate">{node.name}</span>
        </div>
        {isOpen && (
          <div className="relative border-l border-surface-variant/40 ml-3">
            {node.children?.map((child) => (
              <Node
                key={child.id} node={child} depth={depth + 1}
                expandedDirs={expandedDirs} toggleDir={toggleDir}
                openFile={openFile} activePath={activePath}
                onDeleteFile={onDeleteFile} onRenameFile={onRenameFile} collaborators={collaborators}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = node.path === activePath
  // Find collaborators active on this file
  const activePeers = (collaborators || []).filter((c) => c.activeFile === node.path)

  return (
    <div
      className={`group relative flex items-center justify-between h-6 px-2 cursor-pointer transition-colors text-xs font-mono ${
        isActive
          ? 'bg-surface-container text-on-surface border-l-2 border-primary font-bold'
          : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
      }`}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => openFile(node)}
    >
      <div className="flex items-center gap-1.5 truncate">
        <span className={`material-symbols-outlined text-[13px] ${isActive ? 'text-secondary' : 'text-outline'}`}>
          {node.name.endsWith('.js') || node.name.endsWith('.jsx') || node.name.endsWith('.ts') || node.name.endsWith('.tsx') ? 'code_blocks' : 'description'}
        </span>
        <span className="truncate">{node.name}</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Active Collaborator Presence Micro Indicators */}
        {activePeers.map((peer) => (
          <span
            key={peer.userId}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: peer.color }}
            title={`${peer.name} viewing ${node.name}`}
          />
        ))}

        {onRenameFile && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRenameRequest?.(node)
            }}
            className="opacity-0 group-hover:opacity-100 text-outline hover:text-on-surface transition-opacity ml-1"
            title="Rename file"
          >
            <span className="material-symbols-outlined text-[13px]">edit</span>
          </button>
        )}

        {onDeleteFile && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteRequest?.(node)
            }}
            className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-opacity ml-1"
            title="Delete file"
          >
            <span className="material-symbols-outlined text-[13px]">delete</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function SidebarFileTree({ tree, expandedDirs, toggleDir, openFile, activePath, onNewFile, onDeleteFile, onRenameFile, collaborators, members, width }) {
  const [creating,      setCreating]      = useState(false)
  const [confirmState,  setConfirmState]  = useState(null)   // ConfirmDialog state
  const [inputState,    setInputState]    = useState(null)   // InputDialog state

  // Opens the rename InputDialog for a file node
  const handleRenameRequest = (node) => {
    setInputState({
      title:        `Rename "${node.name}"`,
      placeholder:  node.name,
      defaultValue: node.name,
      label:        'Rename',
      onCommit: (newName) => {
        if (newName !== node.name) {
          const dir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : ''
          onRenameFile?.(node.path, dir + newName)
        }
      },
    })
  }

  // Opens the delete ConfirmDialog for a file node
  const handleDeleteRequest = (node) => {
    setConfirmState({
      title:     `Delete "${node.name}"?`,
      body:      'This file will be removed for all collaborators. This cannot be undone.',
      danger:    true,
      label:     'Delete',
      onConfirm: () => onDeleteFile?.(node.path),
    })
  }

  const handleCommit = (name) => {
    setCreating(false)
    if (onNewFile) onNewFile(name)
  }

  const activeUserMap = new Map((collaborators || []).map((c) => [String(c.userId), c]))
  const memberMap = new Map()
  if (members && members.length > 0) {
    members.forEach((m) => {
      const uid = String(m.userId)
      const collab = activeUserMap.get(uid)
      memberMap.set(uid, {
        userId: uid,
        name: m.name,
        role: m.role,
        status: collab ? (collab.status || 'active') : 'offline',
        isActive: collab ? (collab.status === 'active') : false,
      })
    })
  }
  ;(collaborators || []).forEach((c) => {
    const cid = String(c.userId)
    if (!memberMap.has(cid)) {
      memberMap.set(cid, {
        userId: cid,
        name: c.name,
        role: c.role || 'member',
        status: c.status || 'active',
        isActive: c.status === 'active',
      })
    }
  })
  const userList = Array.from(memberMap.values())

  return (
    <>
    <aside
      className="bg-surface-container-lowest border-r border-surface-variant flex flex-col justify-between select-none overflow-hidden flex-shrink-0"
      style={{ width: `${width}px` }}
    >
      {/* Sidebar Section Header */}
      <div className="h-7 px-3 bg-surface-container-low border-b border-surface-variant flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 text-on-surface">
          <span className="material-symbols-outlined text-[14px]">expand_more</span>
          <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface font-bold font-mono">
            EXPLORER
          </span>
        </div>
        {/* The new-file button is omitted for viewers (onNewFile is undefined) */}
        {onNewFile && (
          <div className="flex items-center gap-1 text-outline">
            <button
              onClick={() => setCreating(true)}
              className="hover:text-on-surface transition-colors"
              title="New File"
            >
              <span className="material-symbols-outlined text-[14px]">note_add</span>
            </button>
          </div>
        )}
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1 font-mono">
        {creating && (
          <NewFileInput
            depth={0}
            onCommit={handleCommit}
            onCancel={() => setCreating(false)}
          />
        )}

        {tree.length === 0 && !creating ? (
          <p className="text-xs text-outline px-3 py-3 font-mono leading-relaxed">
            No files in room. Click <strong className="text-on-surface">+</strong> to create a file.
          </p>
        ) : (
          tree.map((node) => (
            <Node
              key={node.id} node={node} depth={0}
              expandedDirs={expandedDirs} toggleDir={toggleDir}
              openFile={openFile} activePath={activePath}
              onDeleteFile={onDeleteFile} onRenameFile={onRenameFile} collaborators={collaborators}
              onRenameRequest={handleRenameRequest}
              onDeleteRequest={handleDeleteRequest}
            />
          ))
        )}
      </div>

      {/* Loom Weave Presence Bar (Bottom Sidebar) */}
      <div className="bg-surface-container-low border-t border-surface-variant flex flex-col p-2 space-y-1.5 flex-shrink-0 max-h-48 overflow-y-auto">
        <div className="flex items-center justify-between pb-1 border-b border-surface-variant/40">
          <span className="font-label-sm text-[10px] uppercase tracking-wider text-on-surface font-bold font-mono">
            Loom Weave ({userList.length})
          </span>
          <span className="font-mono text-[9px] text-tertiary">MESH STATUS</span>
        </div>

        {userList.length <= 1 && (
          <p className="text-[10px] text-outline font-mono py-1">
            You are the only member online. Share invite link to collaborate.
          </p>
        )}

        {userList.map((peer) => (
          <div
            key={peer.userId}
            className="flex items-center justify-between p-1 bg-surface-container font-mono text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${peer.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-outline/40'}`} />
              <div className="flex flex-col truncate">
                <span className="text-[11px] text-on-surface font-bold truncate">{peer.name}</span>
                {peer.role && <span className="text-[9px] text-outline capitalize">{peer.role}</span>}
              </div>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${
              peer.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
              peer.status === 'inactive'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                'bg-surface-variant/30 text-outline/60 border-surface-variant'
            }`}>
              {(peer.status || 'offline').toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </aside>

    {/* File-level modals — rendered outside <aside> so they escape overflow:hidden */}
    <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    <InputDialog   state={inputState}   onClose={() => setInputState(null)} />
  </>
  )
}