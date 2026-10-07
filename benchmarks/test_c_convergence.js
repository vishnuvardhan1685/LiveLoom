const Y = require('yjs')
const { createTestUser, createTestRoom, createRoomInvite, createAndJoinUser, getWsTicket, connectHeadlessClient } = require('./helpers')

async function runConvergenceTest() {
  const owner = await createTestUser('owner_c')
  const room = await createTestRoom(owner.token, 'Convergence Test Room', 2000)
  const inviteToken = await createRoomInvite(owner.token, room.id, 2000)

  const NUM_CLIENTS = 10
  const TOTAL_OPS = process.env.QUICK_MODE ? 1000 : 5000
  const opsPerClient = Math.floor(TOTAL_OPS / NUM_CLIENTS)

  const clients = []
  for (let i = 0; i < NUM_CLIENTS; i++) {
    const { user, ticket } = i === 0
      ? { user: owner, ticket: await getWsTicket(owner.token, room.id) }
      : await createAndJoinUser(owner.token, room, inviteToken, `conv_u_${i}`)
    const client = await connectHeadlessClient({ roomId: room.id, ticket, user })
    clients.push(client)
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '

  const clientPromises = clients.map(async (client) => {
    const ytext = client.doc.getText('convergence_doc')

    for (let op = 0; op < opsPerClient; op++) {
      const len = ytext.length
      const isInsert = len === 0 || Math.random() < 0.65

      if (isInsert) {
        const pos = Math.floor(Math.random() * (len + 1))
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ytext.insert(pos, ch)
      } else {
        const pos = Math.floor(Math.random() * len)
        const delLen = Math.min(Math.floor(Math.random() * 3) + 1, len - pos)
        ytext.delete(pos, delLen)
      }

      if (op % 10 === 0) {
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5)))
      }
    }
  })

  await Promise.all(clientPromises)
  await new Promise((r) => setTimeout(r, 1500))

  const firstText = clients[0].doc.getText('convergence_doc').toString()
  let isIdentical = true

  for (let i = 1; i < clients.length; i++) {
    const text = clients[i].doc.getText('convergence_doc').toString()
    if (text !== firstText) {
      isIdentical = false
      break
    }
  }

  clients.forEach((c) => c.close())

  return {
    totalOps: TOTAL_OPS,
    numClients: NUM_CLIENTS,
    finalTextLength: firstText.length,
    passed: isIdentical,
  }
}

async function runTestC() {
  console.log('\n--- TEST C: Convergence Correctness (10 clients, 5,000 concurrent ops) ---')
  const res = await runConvergenceTest()
  console.log(`Result: ${res.passed ? 'PASSED (Byte-Identical)' : 'FAILED'} | Total Ops: ${res.totalOps} | Final Text Length: ${res.finalTextLength}`)
  return res
}

if (require.main === module) {
  runTestC().catch(console.error)
}

module.exports = { runTestC }
