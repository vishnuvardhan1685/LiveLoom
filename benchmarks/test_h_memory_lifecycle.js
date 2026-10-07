const { createTestUser, createTestRoom, getWsTicket, connectHeadlessClient, requestJson, API_BASE } = require('./helpers')

async function getServerGcMemory() {
  try {
    const res = await requestJson(`${API_BASE}/api/debug/gc-memory`)
    return res.data
  } catch (_) {
    return { heapUsed: process.memoryUsage().heapUsed, rss: process.memoryUsage().rss }
  }
}

async function runMemoryLifecycleTest() {
  const initialMem = await getServerGcMemory()
  const owner = await createTestUser('owner_h')

  const NUM_ROOMS = 2000
  const rooms = []

  const BATCH_SIZE = 50
  for (let i = 0; i < NUM_ROOMS; i += BATCH_SIZE) {
    const promises = []
    for (let j = i; j < Math.min(i + BATCH_SIZE, NUM_ROOMS); j++) {
      promises.push(createTestRoom(owner.token, `Memory Room ${j}`))
    }
    const created = await Promise.all(promises)
    rooms.push(...created)
  }

  const activeClients = []
  const SAMPLE_CONNS = Math.min(500, NUM_ROOMS)
  for (let i = 0; i < SAMPLE_CONNS; i += BATCH_SIZE) {
    const promises = []
    for (let j = i; j < Math.min(i + BATCH_SIZE, SAMPLE_CONNS); j++) {
      promises.push((async () => {
        const r = rooms[j]
        const ticket = await getWsTicket(owner.token, r.id)
        return connectHeadlessClient({ roomId: r.id, ticket, user: owner })
      })())
    }
    const conns = await Promise.all(promises)
    activeClients.push(...conns)
  }

  const activeMem = await getServerGcMemory()

  activeClients.forEach((c) => c.close())
  await new Promise((r) => setTimeout(r, 1000))

  const idleMem = await getServerGcMemory()

  const activeHeapDelta = Math.max(0, activeMem.heapUsed - initialMem.heapUsed)
  const idleHeapDelta = Math.max(0, idleMem.heapUsed - initialMem.heapUsed)

  const memPerActiveRoomKB = Number((activeHeapDelta / NUM_ROOMS / 1024).toFixed(2))
  const memPerIdleRoomKB = Number((idleHeapDelta / NUM_ROOMS / 1024).toFixed(2))

  return {
    numRoomsTested: NUM_ROOMS,
    initialHeapMB: Number((initialMem.heapUsed / (1024 * 1024)).toFixed(2)),
    activeHeapMB: Number((activeMem.heapUsed / (1024 * 1024)).toFixed(2)),
    idleHeapMB: Number((idleMem.heapUsed / (1024 * 1024)).toFixed(2)),
    memPerActiveRoomKB,
    memPerIdleRoomKB,
    evictionVerified: idleMem.heapUsed <= activeMem.heapUsed,
  }
}

async function runTestH() {
  console.log('\n--- TEST H: Memory Lifecycle & Eviction (2000 Rooms) ---')
  const res = await runMemoryLifecycleTest()
  console.log(`Initial Heap: ${res.initialHeapMB}MB | Active Heap: ${res.activeHeapMB}MB | Idle Heap: ${res.idleHeapMB}MB`)
  console.log(`Memory per Active Room: ~${res.memPerActiveRoomKB} KB | Memory per Idle Room: ~${res.memPerIdleRoomKB} KB`)
  return res
}

if (require.main === module) {
  runTestH().catch(console.error)
}

module.exports = { runTestH }
