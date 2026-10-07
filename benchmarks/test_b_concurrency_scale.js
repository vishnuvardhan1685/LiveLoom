const { performance } = require('perf_hooks')
const { createTestUser, createTestRoom, createRoomInvite, createAndJoinUser, connectHeadlessClient, startEventLoopMonitor, computeStats, requestJson, API_BASE } = require('./helpers')

async function getGcMemory() {
  try {
    const res = await requestJson(`${API_BASE}/api/debug/gc-memory`)
    return res.data
  } catch (_) {
    return { heapUsed: process.memoryUsage().heapUsed, rss: process.memoryUsage().rss }
  }
}

async function runConcurrencyScaleTest(targetConns, targetRooms) {
  const elMonitor = startEventLoopMonitor()
  const initialMemData = await getGcMemory()
  const initialHeap = initialMemData.heapUsed

  const owner = await createTestUser('owner_b')
  const rooms = []
  const invites = []

  const ROOM_BATCH = 10
  for (let r = 0; r < targetRooms; r += ROOM_BATCH) {
    const rPromises = []
    for (let k = r; k < Math.min(r + ROOM_BATCH, targetRooms); k++) {
      rPromises.push(
        (async () => {
          const room = await createTestRoom(owner.token, `Scale Room ${k}`, 2000)
          const inviteToken = await createRoomInvite(owner.token, room.id, 2000)
          return { room, inviteToken }
        })()
      )
    }
    const rResults = await Promise.all(rPromises)
    for (const item of rResults) {
      rooms.push(item.room)
      invites.push(item.inviteToken)
    }
  }

  const clients = []
  let errors = 0

  const startTime = performance.now()
  const BATCH_SIZE = 10
  for (let i = 0; i < targetConns; i += BATCH_SIZE) {
    const chunkPromises = []
    for (let j = i; j < Math.min(i + BATCH_SIZE, targetConns); j++) {
      const room = rooms[j % targetRooms]
      const inviteToken = invites[j % targetRooms]
      chunkPromises.push(
        (async () => {
          try {
            const { user, ticket } = await createAndJoinUser(owner.token, room, inviteToken, `scale_u_${j}`)
            return await connectHeadlessClient({ roomId: room.id, ticket, user, timeoutMs: 15000 })
          } catch (e) {
            errors++
            return null
          }
        })()
      )
    }
    const chunkResults = await Promise.all(chunkPromises)
    for (const c of chunkResults) {
      if (c) clients.push(c)
    }
  }

  const connectTimeMs = performance.now() - startTime
  const activeConns = clients.length

  const latencies = []
  if (clients.length > targetRooms) {
    const writer = clients[0]
    const listener = clients[targetRooms]
    const wText = writer.doc.getText('scale_test')
    const lText = listener.doc.getText('scale_test')

    const pending = new Map()
    lText.observe((event) => {
      const now = performance.now()
      event.changes.delta.forEach((d) => {
        if (d.insert && typeof d.insert === 'string' && d.insert.startsWith('sc_')) {
          const id = d.insert
          if (pending.has(id)) {
            latencies.push(now - pending.get(id))
            pending.delete(id)
          }
        }
      })
    })

    for (let k = 0; k < 10; k++) {
      const id = `sc_${k}_${Date.now()}`
      pending.set(id, performance.now())
      wText.insert(0, id)
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  const stats = computeStats(latencies)
  const finalMemData = await getGcMemory()
  const finalHeap = finalMemData.heapUsed
  const elStats = elMonitor.stop()

  clients.forEach((c) => c.close())

  return {
    targetConns,
    targetRooms,
    activeConns,
    errors,
    connectTimeMs: Number(connectTimeMs.toFixed(2)),
    heapMB: Number((finalHeap / (1024 * 1024)).toFixed(2)),
    heapDeltaMB: Number((Math.max(0, finalHeap - initialHeap) / (1024 * 1024)).toFixed(2)),
    rssMB: Number((finalMemData.rss / (1024 * 1024)).toFixed(2)),
    latencyP50: stats.p50,
    latencyP95: stats.p95,
    eventLoopLagP95: Number(elStats.p95Ms),
    exceeds200ms: stats.p95 > 200,
  }
}

async function runTestB() {
  console.log('\n--- TEST B: Concurrency & Scale (100, 500, 1000 conns over 20, 100, 200 rooms) ---')
  const scenarios = [
    { conns: 100, rooms: 20 },
    { conns: 500, rooms: 100 },
    { conns: 1000, rooms: 200 },
  ]

  const results = []
  for (const sc of scenarios) {
    console.log(`Testing ${sc.conns} connections across ${sc.rooms} rooms...`)
    const res = await runConcurrencyScaleTest(sc.conns, sc.rooms)
    results.push(res)
    console.log(
      `  Held: ${res.activeConns}/${sc.conns} (Errors: ${res.errors}) | Heap: ${res.heapMB}MB | Latency p95: ${res.latencyP95}ms | EventLoop Lag p95: ${res.eventLoopLagP95}ms`
    )
  }

  return results
}

if (require.main === module) {
  runTestB().catch(console.error)
}

module.exports = { runTestB }
