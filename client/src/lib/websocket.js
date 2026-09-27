/**
 * WebSocket utilities.
 *
 * Server WS handshake (ws/server.js):
 *   - Listens on /ws path
 *   - Reads query params: ticket, roomId
 *   - consumeTicket validates payload.roomId === query.roomId
 *
 * So the client must send BOTH ticket AND roomId as query params.
 *
 * Server runs on PORT=4000 by default.
 */

export const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000'

/**
 * Build the WebSocket URL for a room session.
 * Both `ticket` and `roomId` are required query params (see ws/connection.js).
 */
export function buildWsUrl(ticket, roomId) {
  return `${WS_URL}/ws?ticket=${encodeURIComponent(ticket)}&roomId=${encodeURIComponent(roomId)}`
}
