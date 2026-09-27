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

// ticket/roomId must go through the `params` option, not be baked into the
// serverUrl string — y-websocket appends its own path/query after serverUrl,
// which corrupted these when they were inlined here before.
export function buildWsBase() {
  return `${WS_URL}/ws`
}