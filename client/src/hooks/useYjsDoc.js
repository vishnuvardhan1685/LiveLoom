import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { MonacoBinding } from 'y-monaco'
import { buildWsUrl } from '@/lib/websocket'

/**
 * Binds a Monaco editor instance to a Yjs Y.Doc via y-monaco.
 *
 * WS URL format (matches ws/connection.js): /ws?ticket=X&roomId=Y
 * Each (roomId + fileId) pair gets its own Y.Doc room: `${roomId}:${fileId}`
 *
 * @param {object} options
 * @param {string}  options.roomId   - backend room id
 * @param {string}  options.fileId   - active file path (used as Yjs room suffix)
 * @param {string|null} options.ticket - WS ticket from POST /rooms/:id/tickets
 * @param {object|null} options.editor - Monaco editor instance
 */
export function useYjsDoc({ roomId, fileId, ticket, editor }) {
  const [syncStatus, setSyncStatus] = useState('offline')

  const ydocRef    = useRef(null)
  const providerRef = useRef(null)
  const bindingRef  = useRef(null)

  // Create Y.Doc + WebsocketProvider whenever roomId / fileId / ticket changes
  useEffect(() => {
    if (!ticket || !roomId || !fileId) return

    // Tear down previous session
    bindingRef.current?.destroy()
    providerRef.current?.destroy()
    ydocRef.current?.destroy()
    bindingRef.current = null
    providerRef.current = null
    ydocRef.current = null

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    // WS room name: roomId:fileId (y-websocket uses this as the room key)
    const wsUrl    = buildWsUrl(ticket, roomId)
    const roomName = `${roomId}:${fileId}`

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc, { connect: true })
    providerRef.current = provider

    setSyncStatus('syncing')

    provider.on('status', ({ status }) => {
      setSyncStatus(status === 'connected' ? 'syncing' : 'offline')
    })

    provider.on('sync', (isSynced) => {
      setSyncStatus(isSynced ? 'synced' : 'syncing')
    })

    return () => {
      bindingRef.current?.destroy()
      provider.destroy()
      ydoc.destroy()
      bindingRef.current = null
      providerRef.current = null
      ydocRef.current = null
      setSyncStatus('offline')
    }
  }, [roomId, fileId, ticket])

  // (Re-)bind Monaco editor when editor / ticket / fileId changes
  useEffect(() => {
    if (!editor || !ticket || !roomId || !fileId) return

    const t = setTimeout(() => {
      if (!ydocRef.current || !providerRef.current) return
      const model = editor.getModel()
      if (!model) return

      bindingRef.current?.destroy()

      const binding = new MonacoBinding(
        ydocRef.current.getText('content'),
        model,
        new Set([editor]),
        providerRef.current.awareness
      )
      bindingRef.current = binding
    }, 50)

    return () => {
      clearTimeout(t)
      bindingRef.current?.destroy()
      bindingRef.current = null
    }
  }, [editor, roomId, fileId, ticket])

  return {
    ydoc:       ydocRef.current,
    provider:   providerRef.current,
    binding:    bindingRef.current,
    syncStatus,
    awareness:  providerRef.current?.awareness ?? null,
  }
}
