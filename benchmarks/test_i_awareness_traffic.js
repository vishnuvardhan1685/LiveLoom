const { performance } = require('perf_hooks')
const { createTestUser, createTestRoom, createRoomInvite, createAndJoinUser, getWsTicket, connectHeadlessClient } = require('./helpers')
async function getAwarenessThrottler() {
  const mod = await import('../client/src/lib/awarenessThrottle.js')
  return mod.createAwarenessThrottler
}

async function runAwarenessTrafficTest(throttled = false) {
  const createAwarenessThrottler = await getAwarenessThrottler()
  const owner = await createTestUser('owner_i')
  const room = await createTestRoom(owner.token, `Awareness Room ${throttled ? 'Throttled' : 'Unthrottled'}`, 2000)
  const inviteToken = await createRoomInvite(owner.token, room.id, 2000)

  const NUM_USERS = 25
  const clients = []

  for (let i = 0; i < NUM_USERS; i++) {
    const { user, ticket } = i === 0
      ? { user: owner, ticket: await getWsTicket(owner.token, room.id) }
      : await createAndJoinUser(owner.token, room, inviteToken, `user_i_${i}`)
    const client = await connectHeadlessClient({ roomId: room.id, ticket, user })
    clients.push(client)
  }

  let totalBytes = 0
  let messageCount = 0

  const receiverWs = clients[0].provider.ws
  if (receiverWs) {
    receiverWs.on('message', (data) => {
      messageCount++
      totalBytes += data.length || data.byteLength || 0
    })
  }

  const DURATION_MS = 4000
  const EVENT_STREAM_INTERVAL_MS = 5 // Simulate 200 Hz raw mouse/cursor events
  const startTime = performance.now()

  // Attach real app awareness throttler (0ms for unthrottled, 50ms for throttled)
  const throttlers = clients.map((c) => createAwarenessThrottler(c.awareness, throttled ? 50 : 0))

  const cursorIntervals = clients.map((client, idx) => {
    let col = 1
    const sendUpdate = throttlers[idx]

    return setInterval(() => {
      if (performance.now() - startTime >= DURATION_MS) return
      col = (col % 100) + 1
      sendUpdate('cursor', { path: 'src/main.js', anchor: col, head: col })
    }, EVENT_STREAM_INTERVAL_MS)
  })

  await new Promise((r) => setTimeout(r, DURATION_MS + 500))

  cursorIntervals.forEach((inv) => clearInterval(inv))
  clients.forEach((c) => c.close())

  const durationSec = DURATION_MS / 1000
  return {
    throttled,
    usersCount: NUM_USERS,
    durationSec,
    totalMessages: messageCount,
    totalBytes,
    msgsPerSec: Number((messageCount / durationSec).toFixed(2)),
    bytesPerSec: Number((totalBytes / durationSec).toFixed(2)),
    kbPerSec: Number((totalBytes / (1024 * durationSec)).toFixed(2)),
  }
}

async function runTestI() {
  console.log('\n--- TEST I: Awareness & Presence Traffic (25 Users) ---')
  console.log('Testing Unthrottled cursor updates (0ms throttle)...')
  const unthrottled = await runAwarenessTrafficTest(false)
  console.log(`Unthrottled: ${unthrottled.msgsPerSec} msgs/s | ${unthrottled.kbPerSec} KB/s`)

  console.log('Testing Throttled cursor updates (50ms app throttle module)...')
  const throttled = await runAwarenessTrafficTest(true)
  console.log(`Throttled:   ${throttled.msgsPerSec} msgs/s | ${throttled.kbPerSec} KB/s`)

  const reductionPercent = Number(
    (((unthrottled.bytesPerSec - throttled.bytesPerSec) / unthrottled.bytesPerSec) * 100).toFixed(2)
  )
  console.log(`Traffic Bandwidth Reduction: ${reductionPercent}%`)

  return { unthrottled, throttled, reductionPercent }
}

if (require.main === module) {
  runTestI().catch(console.error)
}

module.exports = { runTestI }
