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
import { toast } from '@/components/Toast'
import { useUserEvents } from '@/hooks/useUserEvents'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function EditorPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()

  const [room,              setRoom]              = useState(null)
  const [roomError,         setRoomError]         = useState(null)
  const [liveRole,          setLiveRole]          = useState(null)
  const [cursorPos,         setCursorPos]         = useState({ lineNumber: 1, column: 1 })
  const [terminalCollapsed, setTerminalCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [terminalLines,     setTerminalLines]     = useState([])
  const [inviteOpen,        setInviteOpen]        = useState(false)
  const [sidebarVisible,    setSidebarVisible]    = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [hideMobileBanner,  setHideMobileBanner]  = useState(() => typeof window !== 'undefined' && localStorage.getItem('hide_mobile_editor_banner') === 'true')

  // Resizable Panes State
  const [sidebarWidth,   setSidebarWidth]   = useState(250)
  const [terminalHeight, setTerminalHeight] = useState(180)
  const [isResizingSidebar,  setIsResizingSidebar]  = useState(false)
  const [isResizingTerminal, setIsResizingTerminal] = useState(false)

  useDocumentTitle(room?.name ? room.name : 'Editor')

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
        setLiveRole(data.role)
        log(`Connected to room: ${data.name}`, 'success')
      })
      .catch((err) => {
        if (cancelled) return
        const status = err.response?.status
        if (status === 403) {
          setRoomError('You are not a member of this room. Redeem an invite first.')
        } else if (status === 401) {
          navigate('/login')
        } else if (status === 404) {
          setRoomError('Room not found. It may have been deleted or the link is invalid.')
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
    } else if (wsError === 'deleted') {
      toast.warn('This room was deleted by the owner.')
      setRoomError('This room was deleted by the owner.')
    } else if (wsError === 'rate-limited') {
      toast.error('Disconnected: WebSocket message rate limit exceeded.')
      setRoomError('Disconnected: Excessive message rate (code 1008). Auto-reconnect stopped.')
    } else if (wsError === 'payload-too-large') {
      toast.error('Disconnected: Message payload too large.')
      setRoomError('Disconnected: Oversized frame >5.2MB (code 1009). Auto-reconnect stopped.')
    }
  }, [wsError, navigate, log])

  const handleRoleChanged = useCallback(({ roomId: rId, roomName: rName, role: newRole }) => {
    if (rId !== roomId) return
    setLiveRole(newRole)
    log(`Your role in this room was changed to ${newRole}.`, 'info')
    toast.warn(`Your role in "${rName}" was changed to ${newRole}.`)
  }, [roomId, log])

  const handleRoleChangedAck = useCallback(({ roomId: rId, targetName, role: newRole }) => {
    if (rId !== roomId) return
    toast.success(`Role of ${targetName} changed to ${newRole}.`)
  }, [roomId])

  useUserEvents({ onRoleChanged: handleRoleChanged, onRoleChangedAck: handleRoleChangedAck })

  useEffect(() => {
    if (syncStatus === 'synced')  log('Document CRDT state synced.', 'crdt')
    if (syncStatus === 'syncing') log('Syncing document updates…', 'info')
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
    toast.success(`Created file ${path}`)
  }, [ensureFile, openFile, log])

  const handleDeleteFile = useCallback((path) => {
    deleteFile(path)
    closeTab(path)
    log(`Deleted file: ${path}`, 'warn')
    toast.info(`Deleted file ${path}`)
  }, [deleteFile, closeTab, log])

  const handleRenameFile = useCallback((oldPath, newPath) => {
    renameFile(oldPath, newPath)
    closeTab(oldPath)
    openFile({ id: newPath, name: newPath.split('/').pop(), path: newPath, type: 'file' })
    log(`Renamed file ${oldPath} to ${newPath}`, 'info')
    toast.success(`Renamed file to ${newPath}`)
  }, [renameFile, closeTab, openFile, log])

  // ── File upload / drop zone ────────────────────────────────────────────────
  const { uploadFiles, uploads, clearUploads } = useFileUpload(ensureFile)

  const handleFiles = useCallback((files) => {
    uploadFiles(files)
  }, [uploadFiles])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    if (liveRole === 'viewer') return
    const files = await readDroppedItems(e.dataTransfer)
    if (files.length) uploadFiles(files)
  }, [liveRole, uploadFiles])

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
  const readOnly = liveRole === 'viewer'

  const handleDismissMobileBanner = () => {
    setHideMobileBanner(true)
    localStorage.setItem('hide_mobile_editor_banner', 'true')
  }

  const displayError = roomError || ticketError
  if (displayError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-on-surface p-6 font-mono text-center">
        <div className="w-12 h-12 bg-error-container/20 border border-error/50 flex items-center justify-center text-error mb-1">
          <span className="material-symbols-outlined text-[24px]">block</span>
        </div>
        <h2 className="text-lg font-bold font-sans">Room Unavailable</h2>
        <span className="text-xs text-error bg-error-container/30 border border-error/50 px-4 py-2.5 max-w-md leading-relaxed">{displayError}</span>
        <button onClick={() => navigate('/dashboard')} className="ll-btn ll-btn-primary text-xs min-h-[40px] px-4 mt-2">
          ← BACK TO DASHBOARD
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen w-screen bg-background text-on-surface overflow-hidden font-mono"
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
        {/* Desktop Resizable Sidebar */}
        <div className="hidden md:flex flex-shrink-0">
          {sidebarVisible && (
            <>
              <SidebarFileTree
                tree={tree}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
                openFile={openFile}
                activePath={activeTab?.path}
                onNewFile={readOnly    ? undefined : handleNewFile}
                onDeleteFile={readOnly ? undefined : handleDeleteFile}
                onRenameFile={readOnly ? undefined : handleRenameFile}
                collaborators={collaborators}
                members={room?.members}
                width={sidebarWidth}
              />
              <div
                className={`resize-handle-x ${isResizingSidebar ? 'active' : ''}`}
                onMouseDown={() => setIsResizingSidebar(true)}
                title="Drag to resize sidebar"
              />
            </>
          )}
        </div>

        {/* Mobile Slide-in Drawer (<768px) */}
        {sidebarVisible && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSidebarVisible(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] bg-surface-container-low h-full border-r border-surface-variant flex flex-col shadow-2xl">
              <div className="h-10 px-3 bg-surface-container border-b border-surface-variant flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-on-surface">Workspace Menu</span>
                <button
                  onClick={() => setSidebarVisible(false)}
                  className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <SidebarFileTree
                  tree={tree}
                  expandedDirs={expandedDirs}
                  toggleDir={toggleDir}
                  openFile={(file) => {
                    openFile(file)
                    setSidebarVisible(false) // Auto close drawer on mobile file select
                  }}
                  activePath={activeTab?.path}
                  onNewFile={readOnly    ? undefined : handleNewFile}
                  onDeleteFile={readOnly ? undefined : handleDeleteFile}
                  onRenameFile={readOnly ? undefined : handleRenameFile}
                  collaborators={collaborators}
                  members={room?.members}
                  width={288}
                />
              </div>
            </div>
          </div>
        )}

        {/* Center Main Workspace Canvas */}
        <div className="flex flex-col flex-1 min-w-0 bg-surface-container-lowest overflow-hidden">
          {/* Dismissible Mobile Banner */}
          {!hideMobileBanner && (
            <div className="md:hidden bg-surface-container-high border-b border-surface-variant px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-outline">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">devices</span>
                <span>Best experienced on desktop</span>
              </div>
              <button
                onClick={handleDismissMobileBanner}
                className="text-outline hover:text-on-surface p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                aria-label="Dismiss banner"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          )}

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
                  <p className="text-xs text-outline font-mono leading-relaxed">
                    {readOnly
                      ? 'No active file open — select a file from the sidebar.'
                      : 'No active file open — drop files into workspace or create a new file to start collaborating.'}
                  </p>
                  {!readOnly && <FileUploadDropzone onFiles={handleFiles} />}
                  {!readOnly && <FolderUploadButton onFiles={handleFiles} />}
                </div>
              </div>
            )}
          </div>

          {/* Draggable Y Resizer Splitter Handle */}
          {!terminalCollapsed && (
            <div
              className={`resize-handle-y hidden md:block ${isResizingTerminal ? 'active' : ''}`}
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