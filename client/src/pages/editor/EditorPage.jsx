import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { roomsApi } from '@/lib/api'
import { useAuthContext } from '@/app/providers/AuthProvider'
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

export function EditorPage() {
  const { roomId } = useParams()
  const { user } = useAuthContext()

  const [room, setRoom] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, column: 1 })
  const [terminalCollapsed, setTerminalCollapsed] = useState(false)

  useEffect(() => {
    roomsApi.get(roomId).then(({ data }) => setRoom(data)).catch(() => {})
    roomsApi.getTicket(roomId).then(({ data }) => setTicket(data.ticket)).catch(() => {})
  }, [roomId])

  const { awareness, syncStatus, fileTreeVersion, ensureFile, listFilePaths, getFileText } =
    useYjsDoc({ roomId, ticket, user })

  const { tree, activeTab, openTabs, expandedDirs, openFile, closeTab, setActiveTab, toggleDir } =
    useFileTree({ listFilePaths, fileTreeVersion })

  const { uploadFiles, uploads, clearUploads } = useFileUpload(ensureFile)

  const collaborators = useMemo(() => {
    if (!awareness) return []
    return Array.from(awareness.getStates().values())
      .filter((s) => s.user)
      .map((s) => ({ userId: s.user.id, name: s.user.name, color: s.user.color }))
  }, [awareness, fileTreeVersion]) // awareness updates don't retrigger memo on their own; fine as an approximation

  const handleFiles = useCallback((dropped) => uploadFiles(dropped), [uploadFiles])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.items
      ? await readDroppedItems(e.dataTransfer.items)
      : Array.from(e.dataTransfer.files).map((file) => ({ file, relativePath: file.name }))
    handleFiles(dropped)
  }, [handleFiles])

  const activeYText = activeTab ? getFileText(activeTab.path) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}
      onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <TopBar roomName={room?.name ?? '…'} syncStatus={syncStatus} collaborators={collaborators} onInvite={() => {}} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SidebarFileTree tree={tree} expandedDirs={expandedDirs} toggleDir={toggleDir} openFile={openFile} activePath={activeTab?.path} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <EditorTabs tabs={openTabs} activeTabId={activeTab?.id} setActiveTab={setActiveTab} closeTab={closeTab} />

          <div style={{ flex: 1, minHeight: 0 }}>
            {activeYText ? (
              <MonacoEditor
                ytext={activeYText}
                awareness={awareness}
                language={activeTab.language}
                onCursorMove={setCursorPos}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <FileUploadDropzone onFiles={handleFiles} />
                  <FolderUploadButton onFiles={handleFiles} />
                </div>
              </div>
            )}
          </div>

          <TerminalPanel lines={[]} collapsed={terminalCollapsed} onToggle={() => setTerminalCollapsed((c) => !c)} />
          <StatusBar language={activeTab ? getLanguageFromPath(activeTab.name) : null} line={cursorPos.lineNumber} column={cursorPos.column} syncStatus={syncStatus} />
        </div>
      </div>

      <UploadProgressToast uploads={uploads} onDismiss={clearUploads} />
    </div>
  )
}