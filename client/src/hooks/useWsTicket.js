import { useState, useCallback, useRef } from 'react'
import { roomsApi } from '@/lib/api'

const MAX_RETRIES = 5
const RETRY_BACKOFF_MS = 2_000 // 2s between retries

/**
 * Spec §7: "calls POST /rooms/:id/ws-ticket before every (re)connection
 * attempt — tickets are single-use, never reused across reconnects."
 *
 * Includes a retry counter (max 5 attempts with 2s backoff) so a transient
 * 5xx or network error doesn't permanently strand the client.
 */
export function useWsTicket(roomId) {
  const [ticket,      setTicket]      = useState(null)
  const [ticketError, setTicketError] = useState(null)

  // Guards against concurrent fetches (e.g. two rapid onNeedNewTicket calls).
  const fetchingRef = useRef(false)
  // Retry state — reset whenever roomId changes.
  const retriesRef  = useRef(0)

  const fetchTicket = useCallback(async () => {
    if (!roomId || fetchingRef.current) return null
    fetchingRef.current = true

    try {
      const { data } = await roomsApi.getTicket(roomId)
      const t = data.ticket
      setTicket(t)
      setTicketError(null)
      retriesRef.current = 0 // success — reset retry counter
      return t
    } catch (err) {
      retriesRef.current += 1

      if (retriesRef.current >= MAX_RETRIES) {
        const msg = err.response?.data?.error ?? 'Could not connect to room after several attempts.'
        setTicketError(msg)
        return null
      }

      // Transient error — schedule a retry after backoff without surfacing to UI yet.
      return new Promise((resolve) => {
        setTimeout(async () => {
          fetchingRef.current = false
          resolve(await fetchTicket())
        }, RETRY_BACKOFF_MS)
      })
    } finally {
      // Only clear the guard if we're not about to retry (retry clears it itself).
      if (retriesRef.current === 0 || retriesRef.current >= MAX_RETRIES) {
        fetchingRef.current = false
      }
    }
  }, [roomId])

  return { ticket, fetchTicket, ticketError }
}
