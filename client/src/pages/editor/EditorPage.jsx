import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { roomsApi } from '@/lib/api'
import { useAuthContext } from '@/app/providers/AuthProvider'
import { useWsTicket } from '@/hooks/useWsTicket'
import { useYjsDoc } from '@/hooks/useYjsDoc'
import { useFileTree } from '@/hooks/useFileTree'
import { useFileUpload } from '@/hooks/useFileUpload'
import { readDroppedItems, getLanguageFromPath } from '@/lib/fileSystemUtils'
import { TopBar } from '@/components/layout/TopBar'
import { SidebarFileTree } from '@/components/layout/SidebarFileTree'
import { StatusBar } from '@/components/layout/StatusBar'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { MonacoEditor } from '@/components/editor/MonacoEditor'
import { TerminalPanel } from '@/components/editor/TerminalPanel'
import { FileUploadDropzone } from '@/components/upload/FileUploadDropzone'
import { FolderUploadButton } from '@/components/upload/FolderUploadButton'
import { UploadProgressToast } from '@/components/upload/UploadProgressToast'
import { InviteModal } from '@/components/InviteModal'

export function EditorPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()

  const [room,              setRoom]              = useState(null)
  const [roomError,         setRoomError]         = useState(null)
  const [cursorPos,         setCursorPos]         = useState({ lineNumber: 1, column: 1 })
  const [terminalCollapsed, setTerminalCollapsed] = useState(false)
  const [terminalLines,     setTerminalLines]     = useState([])
  const [inviteOpen,        setInviteOpen]        = useState(false)
  const [sidebarVisible,    setSidebarVisible]    = useState(true)

  // Resizable Panes State
  const [sidebarWidth,   setSidebarWidth]   = useState(250)
  const [terminalHeight, setTerminalHeight] = useState(180)
  const [isResizingSidebar,  setIsResizingSidebar]  = useState(false)
  const [isResizingTerminal, setIsResizingTerminal] = useState(false)

  const log = useCallback((text, type = 'info') => {
    setTerminalLines((prev) => [...prev.slice(-199), { text, type }])
  }, [])

  // ── Load room metadata ────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return
    let cancelled = false

    roomsApi.get(roomId)
      .then(({ data }) => {
        if (cancelled) return
        setRoom(data)
        log(`Connected to room: ${data.name}`, 'success')
      })
      .catch((err) => {
        if (cancelled) return
        const status = err.response?.status
        if (status === 403) {
          setRoomError('You are not a member of this room. Redeem an invite first.')
        } else if (status === 401) {
          navigate('/login')
        } else {
          setRoomError(err.response?.data?.error ?? 'Failed to load room.')
        }
      })

    return () => { cancelled = true }
  }, [roomId, navigate, log])

  // ── WS ticket ──────────────────────────────────────────────────────────────
  const { ticket, fetchTicket, ticketError } = useWsTicket(roomId)

  useEffect(() => {
    if (roomId) fetchTicket()
  }, [roomId, fetchTicket])

  const handleNeedNewTicket = useCallback(() => {
    fetchTicket().then((t) => {
      if (t) log('Reconnecting with fresh ticket…', 'info')
    })
  }, [fetchTicket, log])

  // ── Yjs room-level doc ───────────────────────────────────────────────────
  const {
    awareness, syncStatus, wsError, wasConnected, fileTreeVersion,
    ensureFile, deleteFile, renameFile, listFilePaths, getFileText, onEditorActivity,
  } = useYjsDoc({ roomId, ticket, user, onNeedNewTicket: handleNeedNewTicket })

  useEffect(() => {
    if (wsError === 'reauth') {
      log('Session expired — please sign in again.', 'error')
      navigate('/login')
    } else if (wsError === 'full') {
      setRoomError('This room is currently full. Try again later.')
    }
  }, [wsError, navigate, log])

  useEffect(() => {
    if (syncStatus === 'synced')  log('Document CRDT state synced.', 'crdt')
    if (syncStatus === 'syncing') log('Syncing document updates…', 'info')
    // Only log "Disconnected" if we actually connected in this session.
    // Suppresses the spurious log during React StrictMode double-mount cleanup.
    if (syncStatus === 'offline' && wasConnected.current) log('Disconnected from room server.', 'warn')
  }, [syncStatus, log])

  // ── File tree & tab state ──────────────────────────────────────────────────
  const {
    tree, openTabs, activeTab, expandedDirs,
    toggleDir, openFile, closeTab, setActiveTab,
  } = useFileTree({ listFilePaths, fileTreeVersion })

  const handleNewFile = useCallback((name) => {
    if (!name) return
    const path = name.startsWith('/') ? name.slice(1) : name
    ensureFile(path, '')
    openFile({ id: path, name: path.split('/').pop(), path, type: 'file' })
    log(`Created file: ${path}`, 'info')
  }, [ensureFile, openFile, log])

  const handleDeleteFile = useCallback((path) => {
    deleteFile(path)
    closeTab(path)
    log(`Deleted file: ${path}`, 'warn')
  }, [deleteFile, closeTab, log])

  const handleRenameFile = useCallback((oldPath, newPath) => {
    renameFile(oldPath, newPath)
    closeTab(oldPath)
    openFile({ id: newPath, name: newPath.split('/').pop(), path: newPath, type: 'file' })
    log(`Renamed file ${oldPath} to ${newPath}`, 'info')
  }, [renameFile, closeTab, openFile, log])

  // ── File upload / drop zone ────────────────────────────────────────────────
  const { uploadFiles, uploads, clearUploads } = useFileUpload(ensureFile)

  const handleFiles = useCallback((files) => {
    uploadFiles(files)
  }, [uploadFiles])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    if (room?.role === 'viewer') return
    const files = await readDroppedItems(e.dataTransfer)
    if (files.length) uploadFiles(files)
  }, [room, uploadFiles])

  // ── Resizable Splitters Logic ──────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(160, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }
    if (isResizingTerminal) {
      const newHeight = Math.max(80, Math.min(600, window.innerHeight - e.clientY - 28))
      setTerminalHeight(newHeight)
    }
  }, [isResizingSidebar, isResizingTerminal])

  const handleMouseUp = useCallback(() => {
    setIsResizingSidebar(false)
    setIsResizingTerminal(false)
  }, [])

  useEffect(() => {
    if (isResizingSidebar || isResizingTerminal) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizingSidebar, isResizingTerminal, handleMouseMove, handleMouseUp])

  // ── Awareness reactivity ──────────────────────────────────────────────────
  const [awarenessVersion, setAwarenessVersion] = useState(0)

  useEffect(() => {
    if (!awareness) return
    const onChange = () => setAwarenessVersion((v) => v + 1)
    awareness.on('change', onChange)
    // Read initial states immediately — the server already sent them via
    // sendCurrentStates() before our listener was attached.
    onChange()
    return () => awareness.off('change', onChange)
  }, [awareness])


  const collaborators = useMemo(() => {
    if (!awareness) return []
    return Array.from(awareness.getStates().entries())
      .filter(([, s]) => s.user)
      .map(([clientID, s]) => ({
        userId:     String(s.user.id),
        name:       s.user.name,
        color:      s.user.color,
        typing:     !!s.typing,
        activeFile: s.cursor?.path || null,
        isLocal:    clientID === awareness.clientID,
        status:     s.user.status || 'active',
      }))
  }, [awareness, awarenessVersion])

  const remotePeersCount = useMemo(() => {
    return collaborators.filter((c) => !c.isLocal).length
  }, [collaborators])

  const activeYText = activeTab ? getFileText(activeTab.path) : null
  const readOnly    = room?.role === 'viewer'

  const displayError = roomError || ticketError
  if (displayError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background text-on-surface p-6 font-mono">
        <span className="text-sm text-error bg-error-container/30 border border-error/50 px-4 py-2">{displayError}</span>
        <button onClick={() => navigate('/dashboard')} className="ll-btn ll-btn-ghost text-xs">
          ← BACK TO DASHBOARD
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen bg-background text-on-surface overflow-hidden font-mono"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <TopBar
        roomName={room?.name ?? '…'}
        syncStatus={syncStatus}
        collaborators={collaborators}
        readOnly={readOnly}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((v) => !v)}
        onInvite={() => setInviteOpen(true)}
        onBack={() => navigate('/dashboard')}
      />

      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* Left Resizable Sidebar */}
        {sidebarVisible && (
          <>
            <SidebarFileTree
              tree={tree}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              openFile={openFile}
              activePath={activeTab?.path}
              onNewFile={handleNewFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              collaborators={collaborators}
              members={room?.members}
              width={sidebarWidth}
            />
            {/* Draggable X Resizer Splitter Handle */}
            <div
              className={`resize-handle-x ${isResizingSidebar ? 'active' : ''}`}
              onMouseDown={() => setIsResizingSidebar(true)}
              title="Drag to resize sidebar"
            />
          </>
        )}

        {/* Center Main Workspace Canvas */}
        <div className="flex flex-col flex-1 min-w-0 bg-surface-container-lowest overflow-hidden">
          <EditorTabs
            tabs={openTabs}
            activeTabId={activeTab?.id}
            setActiveTab={setActiveTab}
            closeTab={closeTab}
          />

          <div className="flex-1 min-h-0 relative bg-surface-container-lowest">
            {activeYText ? (
              <MonacoEditor
                ytext={activeYText}
                awareness={awareness}
                language={activeTab?.language}
                readOnly={readOnly}
                onCursorMove={setCursorPos}
                onEditorActivity={onEditorActivity}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-6 bg-surface-container-lowest">
                <div className="w-full max-w-md flex flex-col gap-3 items-center text-center">
                  <span className="material-symbols-outlined text-[40px] text-primary">code_blocks</span>
                  <p className="text-xs text-outline font-mono">
                    No active file open — drop files into workspace or create a new file to start collaborating.
                  </p>
                  <FileUploadDropzone onFiles={handleFiles} />
                  <FolderUploadButton onFiles={handleFiles} />
                </div>
              </div>
            )}
          </div>

          {/* Draggable Y Resizer Splitter Handle */}
          {!terminalCollapsed && (
            <div
              className={`resize-handle-y ${isResizingTerminal ? 'active' : ''}`}
              onMouseDown={() => setIsResizingTerminal(true)}
              title="Drag to resize terminal panel"
            />
          )}

          {/* Bottom Resizable Terminal Panel */}
          <TerminalPanel
            lines={terminalLines}
            collapsed={terminalCollapsed}
            onToggle={() => setTerminalCollapsed((c) => !c)}
            height={terminalHeight}
          />

          {/* Bottom Status Bar */}
          <StatusBar
            language={activeTab ? getLanguageFromPath(activeTab.name) : null}
            line={cursorPos.lineNumber}
            column={cursorPos.column}
            syncStatus={syncStatus}
            activePeersCount={remotePeersCount}
          />
        </div>
      </div>

      <UploadProgressToast uploads={uploads} onDismiss={clearUploads} />

      {inviteOpen && room && (
        <InviteModal roomId={roomId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  )
}