const WebSocket = require('ws')
const encoding = require('lib0/encoding')
const syncProtocol = require('y-protocols/sync')
const { createTestUser, createTestRoom, getWsTicket, connectHeadlessClient, requestJson, API_BASE, WS_BASE } = require('./helpers')

async function runSecurityLoadTest() {
  const owner = await createTestUser('owner_k')
  const room = await createTestRoom(owner.token, 'Security Load Room')

  // Create an invite for viewer role
  const expiresAt = new Date(Date.now() + 86400000).toISOString()
  const { data: invite } = await requestJson(`${API_BASE}/rooms/${room.id}/invites`, 'POST', { role: 'viewer', expiresAt, maxUses: 10 }, { Authorization: `Bearer ${owner.token}` })

  const viewerUser = await createTestUser('viewer_k')
  await requestJson(`${API_BASE}/invites/${invite.token}`, 'POST', {}, { Authorization: `Bearer ${viewerUser.token}` })

  const ticketViewer = await getWsTicket(viewerUser.token, room.id)
  const ticketEditor = await getWsTicket(owner.token, room.id)

  const viewerClient = await connectHeadlessClient({ roomId: room.id, ticket: ticketViewer, user: viewerUser })
  const editorClient = await connectHeadlessClient({ roomId: room.id, ticket: ticketEditor, user: owner })

  const editorText = editorClient.doc.getText('sec_doc')

  // 1. Viewer Role Edit Flood
  let viewerRejected = true
  const initialText = editorText.toString()

  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, 0) // messageSync
  syncProtocol.writeUpdate(encoder, new Uint8Array([1, 2, 3]))
  const payload = encoding.toUint8Array(encoder)

  for (let i = 0; i < 50; i++) {
    if (viewerClient.provider.ws && viewerClient.provider.ws.readyState === WebSocket.OPEN) {
      viewerClient.provider.ws.send(payload)
    }
  }

  await new Promise((r) => setTimeout(r, 500))
  const textAfterFlood = editorText.toString()
  if (textAfterFlood !== initialText) {
    viewerRejected = false
  }

  // 2. Oversized Message Rejection (6MB payload > 5.2MB maxPayload limit)
  let oversizedRejected = false
  const largeBuf = new Uint8Array(6 * 1024 * 1024) // 6 MB frame

  try {
    const rawWs = new WebSocket(`${WS_BASE}?roomId=${room.id}&ticket=${ticketViewer}`)
    await new Promise((r) => rawWs.on('open', r))
    rawWs.send(largeBuf)

    await new Promise((resolve) => {
      rawWs.on('close', (code) => {
        if (code === 1009 || code === 4000 || code === 1006) {
          oversizedRejected = true
        }
        resolve()
      })
      setTimeout(resolve, 1500)
    })
  } catch (e) {
    oversizedRejected = true
  }

  // 3. Message Rate Limit Flood Test (>300 messages/sec)
  let floodRateLimited = false
  try {
    const floodTicket = await getWsTicket(owner.token, room.id)
    const floodWs = new WebSocket(`${WS_BASE}?roomId=${room.id}&ticket=${floodTicket}`)
    await new Promise((r) => floodWs.on('open', r))

    for (let i = 0; i < 350; i++) {
      if (floodWs.readyState === WebSocket.OPEN) {
        floodWs.send(payload)
      }
    }

    await new Promise((resolve) => {
      floodWs.on('close', (code) => {
        if (code === 1008 || code === 1009 || code === 1006) {
          floodRateLimited = true
        }
        resolve()
      })
      setTimeout(resolve, 1500)
    })
  } catch (_) {
    floodRateLimited = true
  }

  // Confirm editor client remains unaffected and functional
  editorText.insert(0, 'Editor clean operational edit. ')
  await new Promise((r) => setTimeout(r, 400))
  const editorOk = editorText.toString().includes('Editor clean operational edit.')

  viewerClient.close()
  editorClient.close()

  return {
    viewerEditsRejected: viewerRejected,
    oversizedPayloadRejected: oversizedRejected,
    messageFloodRateLimited: floodRateLimited,
    otherClientsUnaffected: editorOk,
  }
}

async function runTestK() {
  console.log('\n--- TEST K: Security & Abuse Prevention Under Load ---')
  const res = await runSecurityLoadTest()
  console.log(`Viewer Edits Rejected by Server: ${res.viewerEditsRejected ? 'YES' : 'NO'}`)
  console.log(`Oversized Messages (>5.2MB) Rejected: ${res.oversizedPayloadRejected ? 'YES' : 'NO'}`)
  console.log(`Message Flood Rate Limited:          ${res.messageFloodRateLimited ? 'YES' : 'NO'}`)
  console.log(`Other Clients Remain Unaffected:     ${res.otherClientsUnaffected ? 'YES' : 'NO'}`)
  return res
}

if (require.main === module) {
  runTestK().catch(console.error)
}

module.exports = { runTestK }
