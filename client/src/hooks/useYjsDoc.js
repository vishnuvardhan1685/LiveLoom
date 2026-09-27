import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { buildWsBase } from '@/lib/websocket'
import { colorForUserId } from '@/lib/collabColors'

/**
 * One Y.Doc + one WebsocketProvider per ROOM (not per file). Matches the
 * server: docRegistry keys a single Y.Doc by roomId, and Document.js stores
 * one snapshot per room. Individual files live as Y.Text values inside a
 * shared Y.Map('files'), keyed by relative path.
 */
export function useYjsDoc({ roomId, ticket, user }) {
  const [syncStatus, setSyncStatus] = useState('offline')
  const [fileTreeVersion, setFileTreeVersion] = useState(0) // bump on files-map change

  const ydocRef     = useRef(null)
  const providerRef = useRef(null)
  const filesMapRef = useRef(null)

  useEffect(() => {
    if (!ticket || !roomId) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const filesMap = ydoc.getMap('files')
    filesMapRef.current = filesMap

    const provider = new WebsocketProvider(buildWsBase(), roomId, ydoc, {
      params: { ticket, roomId },
    })
    providerRef.current = provider

    if (user) {
      provider.awareness.setLocalStateField('user', {
        id: user.id,
        name: user.name ?? user.email,
        color: colorForUserId(user.id),
      })
    }

    setSyncStatus('syncing')
    provider.on('status', ({ status }) => setSyncStatus(status === 'connected' ? 'syncing' : 'offline'))
    provider.on('sync', (isSynced) => setSyncStatus(isSynced ? 'synced' : 'syncing'))

    const onFilesChange = () => setFileTreeVersion((v) => v + 1)
    filesMap.observe(onFilesChange)

    return () => {
      filesMap.unobserve(onFilesChange)
      provider.destroy()
      ydoc.destroy()
      ydocRef.current = null
      providerRef.current = null
      filesMapRef.current = null
      setSyncStatus('offline')
    }
  }, [roomId, ticket, user?.id])

  /** Create a file if it doesn't exist yet; no-op (keeps history) if it does. */
  const ensureFile = useCallback((path, initialContent = '') => {
    const filesMap = filesMapRef.current
    if (!filesMap || filesMap.has(path)) return
    const ytext = new Y.Text()
    if (initialContent) ytext.insert(0, initialContent)
    filesMap.set(path, ytext)
  }, [])

  const deleteFile = useCallback((path) => {
    filesMapRef.current?.delete(path)
  }, [])

  const listFilePaths = useCallback(() => {
    return filesMapRef.current ? Array.from(filesMapRef.current.keys()) : []
  }, [])

  const getFileText = useCallback((path) => {
    return filesMapRef.current?.get(path) ?? null
  }, [])

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    awareness: providerRef.current?.awareness ?? null,
    syncStatus,
    fileTreeVersion, // dependency for consumers deriving the tree from listFilePaths()
    ensureFile,
    deleteFile,
    listFilePaths,
    getFileText,
  }
}