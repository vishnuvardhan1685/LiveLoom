import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { removeAwarenessStates } from 'y-protocols/awareness'
import { buildWsBase } from '@/lib/websocket'
import { colorForUserId } from '@/lib/collabColors'

const TYPING_DEBOUNCE_MS = 1500 // spec §7: ~1.5s debounce to clear typing:true

export function useYjsDoc({ roomId, ticket, user, role, onNeedNewTicket }) {
  const [syncStatus,      setSyncStatus]      = useState('offline')
  const [wsError,         setWsError]         = useState(null)   // 'full' | null
  const [fileTreeVersion, setFileTreeVersion] = useState(0)

  // Reactive state — cause re-renders so dependent effects re-attach promptly.
  const [ydoc,      setYdoc]      = useState(null)
  const [provider,  setProvider]  = useState(null)
  const [awareness, setAwareness] = useState(null)

  // Refs for mutable access inside callbacks (stale-closure-safe).
  const filesMapRef        = useRef(null)
  const ydocRef            = useRef(null)  // mirrors ydoc state for sync callback access
  const idbRef             = useRef(null)
  const typingTimerRef     = useRef(null)
  const reconnectTimerRef  = useRef(null)
  // wasConnectedRef: becomes true the first time the WS connects successfully.
  // Used to skip the "Disconnected" terminal log during StrictMode mount/cleanup.
  const wasConnectedRef    = useRef(false)
  // Expose onEditorActivity so MonacoEditor can reset the idle timer when
  // Monaco captures key/cursor events that bypass document listeners.
  const editorActivityRef  = useRef(null)

  useEffect(() => {
    if (!ticket || !roomId) return

    // ── Tear down any previous session ──────────────────────────────────────
    // (provider/idb/ydoc are local variables below; the previous ones were
    //  already destroyed in the previous cleanup return.)
    setWsError(null)

    // ── Y.Doc ────────────────────────────────────────────────────────────────
    const doc = new Y.Doc()
    ydocRef.current = doc
    setYdoc(doc)

    const filesMap = doc.getMap('files')
    filesMapRef.current = filesMap

    // ── Files map observer — fires on every subsequent remote/local change ───
    const onFilesChange = () => setFileTreeVersion((v) => v + 1)
    filesMap.observe(onFilesChange)

    // ── y-indexeddb (local persistence — spec §7) ────────────────────────────
    const idb = new IndexeddbPersistence(`liveloom-room-${roomId}`, doc)
    idbRef.current = idb

    idb.on('synced', () => {
      setFileTreeVersion((v) => v + 1)
    })

    // ── WebSocket provider ────────────────────────────────────────────────────
    // disableBc:true prevents the BroadcastChannel transport from syncing
    // two same-browser tabs via shared memory (they should sync via the server).
    // Tickets are now HMAC tokens — y-websocket's auto-reconnect reuses them
    // without hitting 4001, so we no longer need to set resyncInterval:-1.
    const ws = new WebsocketProvider(buildWsBase(), roomId, doc, {
      params:    { ticket, roomId },
      disableBc: true,
    })
    setProvider(ws)
    setAwareness(ws.awareness)

    // ── Local awareness state & presence status ────────────────────────────────
    if (user) {
      ws.awareness.setLocalStateField('user', {
        id:     user.id,
        name:   user.name ?? user.email,
        role:   role || user.role || 'member',
        color:  colorForUserId(user.id),
        status: 'active',
      })
    }

    // ── Throttled status writer — prevents awareness spam on every mousemove ──
    // currentStatusRef holds the last value we actually wrote so we never
    // send a redundant awareness update.
    const currentStatusRef = { current: 'active' }
    const setLocalStatus = (nextStatus) => {
      if (currentStatusRef.current === nextStatus) return // nothing changed
      const state = ws.awareness.getLocalState()
      if (!state?.user) return
      currentStatusRef.current = nextStatus
      ws.awareness.setLocalStateField('user', { ...state.user, status: nextStatus })
    }

    // ── Idle detection ────────────────────────────────────────────────────────
    // Rules:
    //   INACTIVE when: tab hidden  OR  30 s of no qualifying input events
    //   ACTIVE   when: tab visible AND any qualifying input event received
    //   window 'blur' alone does NOT cause inactive (two windows side-by-side).
    const IDLE_TIMEOUT_MS = 30000
    let idleTimer = null

    const scheduleIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        // Only go inactive from idle if the tab is still visible.
        // If the tab is already hidden the visibilitychange handler already set inactive.
        if (!document.hidden) setLocalStatus('inactive')
      }, IDLE_TIMEOUT_MS)
    }

    const handleUserActivity = () => {
      if (!document.hidden) setLocalStatus('active')
      scheduleIdle()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(idleTimer)       // stop the idle countdown while hidden
        setLocalStatus('inactive')
      } else {
        handleUserActivity()          // tab visible again → active + restart idle
      }
    }

    const handleBeforeUnload = () => {
      if (ws.awareness) {
        removeAwarenessStates(ws.awareness, [ws.awareness.clientID], 'tab close')
      }
    }

    const onAwarenessChange = () => {
      // Awareness state updated
    }
    ws.awareness.on('change', onAwarenessChange)

    // Expose handleUserActivity so MonacoEditor can reset the idle timer for
    // keystrokes/cursor moves that Monaco captures before document listeners fire.
    editorActivityRef.current = handleUserActivity

    // Input events that count as activity.  mousedown included (not just mousemove)
    // so clicking in another app window while LiveLoom is in the background does
    // NOT reset the idle timer (mousedown only fires when the LiveLoom doc has focus).
    const ACT_EVENTS = ['keydown', 'mousedown', 'mousemove', 'wheel', 'touchstart']
    ACT_EVENTS.forEach((ev) => document.addEventListener(ev, handleUserActivity, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    handleUserActivity() // start idle countdown immediately

    // ── Typing indicator (spec §7) ────────────────────────────────────────────
    const onDocUpdate = (_update, origin) => {
      setFileTreeVersion((v) => v + 1)
      if (origin === ws) return
      ws.awareness.setLocalStateField('typing', true)
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        ws.awareness.setLocalStateField('typing', false)
      }, TYPING_DEBOUNCE_MS)
    }
    doc.on('update', onDocUpdate)

    // ── Status / sync state ──────────────────────────────────────────────────
    const updateSyncState = () => {
      if (ws.wsconnected) {
        setSyncStatus(ws.synced ? 'synced' : 'syncing')
      } else {
        setSyncStatus('offline')
      }
      if (ws.synced) {
        setFileTreeVersion((v) => v + 1)
      }
    }

    ws.on('status', (ev) => {
      if (ev.status === 'connected') wasConnectedRef.current = true
      updateSyncState()
    })
    ws.on('sync', updateSyncState)
    updateSyncState()

    // ── Connection close handling ─────────────────────────────────────────────
    // 4001: token expired/invalid → fetch a new ticket (triggers effect re-run).
    // 4002: room full → surface error.
    // 4403: room deleted by owner → stop reconnecting, redirect to dashboard.
    // All others: y-websocket auto-reconnects with the same HMAC token.
    const handleConnClose = (event) => {
      if (event.code === 4001) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          onNeedNewTicket?.()
        }, 300)
        return
      }
      if (event.code === 4002) {
        setWsError('full')
        return
      }
      if (event.code === 4403) {
        // Destroy immediately so y-websocket's internal reconnect timer never fires.
        ws.destroy()
        setWsError('deleted')
        return
      }
      if (event.code === 1008) {
        ws.destroy()
        setWsError('rate-limited')
        return
      }
      if (event.code === 1009) {
        ws.destroy()
        setWsError('payload-too-large')
        return
      }
    }
    ws.on('connection-close', handleConnClose)

    return () => {
      clearTimeout(typingTimerRef.current)
      clearTimeout(reconnectTimerRef.current)
      clearTimeout(idleTimer)
      editorActivityRef.current = null
      ACT_EVENTS.forEach((ev) => document.removeEventListener(ev, handleUserActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      ws.awareness.off('change', onAwarenessChange)
      doc.off('update', onDocUpdate)
      filesMap.unobserve(onFilesChange)
      ws.off('connection-close', handleConnClose)

      if (ws.awareness) {
        removeAwarenessStates(ws.awareness, [ws.awareness.clientID], 'provider destroy')
      }
      ws.destroy()
      idb.destroy()
      doc.destroy()
      filesMapRef.current = null
      ydocRef.current     = null
      idbRef.current      = null
      wasConnectedRef.current = false
      setYdoc(null)
      setProvider(null)
      setAwareness(null)
      setSyncStatus('offline')
    }
  }, [roomId, ticket, user?.id]) // re-run whenever a new ticket is issued

  /** Create a file entry in the shared Y.Map inside doc.transact if it doesn't already exist. */
  const ensureFile = useCallback((path, initialContent = '') => {
    const filesMap = filesMapRef.current
    const doc = ydocRef.current
    if (!filesMap) return
    if (filesMap.has(path)) return // keep existing CRDT history intact
    const ytext = new Y.Text()
    if (initialContent) ytext.insert(0, initialContent)
    if (doc) {
      doc.transact(() => {
        filesMap.set(path, ytext)
      })
    } else {
      filesMap.set(path, ytext)
    }
  }, [])

  const deleteFile = useCallback((path) => {
    const filesMap = filesMapRef.current
    const doc = ydocRef.current
    if (!filesMap) return
    if (doc) {
      doc.transact(() => {
        filesMap.delete(path)
      })
    } else {
      filesMap.delete(path)
    }
  }, [])

  const renameFile = useCallback((oldPath, newPath) => {
    const filesMap = filesMapRef.current
    const doc = ydocRef.current
    if (!filesMap || !oldPath || !newPath || oldPath === newPath) return
    const ytext = filesMap.get(oldPath)
    if (!ytext) return
    if (doc) {
      doc.transact(() => {
        filesMap.set(newPath, ytext)
        filesMap.delete(oldPath)
      })
    } else {
      filesMap.set(newPath, ytext)
      filesMap.delete(oldPath)
    }
  }, [])

  const listFilePaths = useCallback(() => {
    return filesMapRef.current ? Array.from(filesMapRef.current.keys()) : []
  }, [])

  const getFileText = useCallback((path) => {
    return filesMapRef.current?.get(path) ?? null
  }, [])

  // Stable callback that callers (MonacoEditor) use to signal user activity.
  const onEditorActivity = useCallback(() => {
    editorActivityRef.current?.()
  }, [])

  return {
    ydoc,
    provider,
    awareness,
    syncStatus,
    wsError,
    wasConnected: wasConnectedRef,   // ref — intentionally mutable, not state
    fileTreeVersion,
    ensureFile,
    deleteFile,
    renameFile,
    listFilePaths,
    getFileText,
    onEditorActivity,
  }
}