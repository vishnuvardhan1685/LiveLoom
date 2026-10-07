const Y = require('yjs')
const { performance } = require('perf_hooks')
const { createTestUser, createTestRoom, getWsTicket, connectHeadlessClient } = require('./helpers')

async function runOfflineReconnectTest() {
  const owner = await createTestUser('owner_d')
  const peerUser = await createTestUser('user_d_peer')
  const room = await createTestRoom(owner.token, 'Offline Reconnect Room')

  // Connect Client A and Client B
  const ticketA1 = await getWsTicket(owner.token, room.id)
  const ticketB = await getWsTicket(owner.token, room.id)

  let clientA = await connectHeadlessClient({ roomId: room.id, ticket: ticketA1, user: owner })
  const clientB = await connectHeadlessClient({ roomId: room.id, ticket: ticketB, user: peerUser })

  const textA = clientA.doc.getText('offline_test')
  const textB = clientB.doc.getText('offline_test')

  textA.insert(0, 'Initial state. ')
  await new Promise((r) => setTimeout(r, 500))

  // Simulate Client A going offline (disconnect WS)
  clientA.provider.destroy()

  // Client A edits offline for simulated time while disconnected locally
  const offlineEdits = '[Offline edit by A] '
  textA.insert(textA.length, offlineEdits)

  // Meanwhile, Client B continues typing online
  const onlineEdits = '[Online edit by B] '
  textB.insert(textB.length, onlineEdits)

  // Reconnect Client A with a new ticket after delay
  const ticketA2 = await getWsTicket(owner.token, room.id)
  const reconnectStart = performance.now()

  // Connect new provider using Client A's offline doc state
  const { WebsocketProvider } = require('y-websocket')
  const WebSocket = require('ws')
  const { WS_BASE } = require('./helpers')

  const providerA2 = new WebsocketProvider(WS_BASE, room.id, clientA.doc, {
    WebSocketPolyfill: WebSocket,
    params: { ticket: ticketA2, roomId: room.id },
    disableBc: true,
  })

  await new Promise((resolve) => {
    providerA2.on('sync', (isSynced) => {
      if (isSynced) resolve()
    })
  })

  // Wait for convergence
  await new Promise((r) => setTimeout(r, 600))
  const convergeTimeMs = performance.now() - reconnectStart

  const finalA = textA.toString()
  const finalB = textB.toString()

  const containsOfflineEdits = finalA.includes(offlineEdits) && finalB.includes(offlineEdits)
  const containsOnlineEdits = finalA.includes(onlineEdits) && finalB.includes(onlineEdits)
  const isByteIdentical = finalA === finalB

  // Clean up
  providerA2.destroy()
  clientA.doc.destroy()
  clientB.close()

  return {
    reconvergeTimeMs: Number(convergeTimeMs.toFixed(2)),
    isByteIdentical,
    noLostEdits: containsOfflineEdits && containsOnlineEdits && isByteIdentical,
    finalTextLength: finalA.length,
  }
}

async function runTestD() {
  console.log('\n--- TEST D: Offline / Reconnect Sync ---')
  const res = await runOfflineReconnectTest()
  console.log(
    `Re-converge Time: ${res.reconvergeTimeMs}ms | Byte Identical: ${res.isByteIdentical} | Zero Lost Edits: ${res.noLostEdits}`
  )
  return res
}

if (require.main === module) {
  runTestD().catch(console.error)
}

module.exports = { runTestD }
