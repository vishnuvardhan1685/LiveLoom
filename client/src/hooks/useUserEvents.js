/**
 * useUserEvents.js — subscribes to GET /rooms/events (SSE) and dispatches
 * room-management events (room-deleted, role-changed, role-changed-ack) to
 * registered handlers.
 *
 * Mount once per page that needs real-time room-level notifications.
 * EventSource is authenticated via ?token= (EventSource can't set headers).
 *
 * Usage:
 *   useUserEvents({
 *     onRoomDeleted:    ({ roomId, roomName }) => { ... },
 *     onRoleChanged:    ({ roomId, roomName, role }) => { ... },        // affected user
 *     onRoleChangedAck: ({ roomId, targetName, role }) => { ... },     // owner
 *   })
 */
import { useEffect, useRef } from 'react'

export function useUserEvents({ onRoomDeleted, onRoleChanged, onRoleChangedAck } = {}) {
  // Keep latest callbacks in refs so the effect never needs to re-run when they change.
  const onRoomDeletedRef    = useRef(onRoomDeleted)
  const onRoleChangedRef    = useRef(onRoleChanged)
  const onRoleChangedAckRef = useRef(onRoleChangedAck)

  useEffect(() => { onRoomDeletedRef.current    = onRoomDeleted    }, [onRoomDeleted])
  useEffect(() => { onRoleChangedRef.current    = onRoleChanged    }, [onRoleChanged])
  useEffect(() => { onRoleChangedAckRef.current = onRoleChangedAck }, [onRoleChangedAck])

  useEffect(() => {
    const token = localStorage.getItem('ll_token')
    if (!token) return

    // EventSource doesn't support Authorization headers; pass token as query param.
    const url = `/rooms/events?token=${encodeURIComponent(token)}`
    const es  = new EventSource(url)

    es.onmessage = (e) => {
      let event
      try { event = JSON.parse(e.data) } catch { return }

      if (event.type === 'room-deleted') {
        onRoomDeletedRef.current?.(event)
      } else if (event.type === 'role-changed') {
        onRoleChangedRef.current?.(event)
      } else if (event.type === 'role-changed-ack') {
        onRoleChangedAckRef.current?.(event)
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed.
    }

    return () => es.close()
  }, []) // intentionally empty — only open once per mount
}

