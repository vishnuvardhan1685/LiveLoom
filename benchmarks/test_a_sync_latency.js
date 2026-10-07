const { performance } = require('perf_hooks')
const { createTestUser, prepareRoomClients, connectHeadlessClient, computeStats } = require('./helpers')

async function runSyncLatencyTestForRoomSize(roomSize) {
  const owner = await createTestUser('owner_a')
  const { room, userTickets } = await prepareRoomClients(owner, roomSize, 'Sync_Latency_Room')

  // Connect all clients with a small 15ms stagger to prevent connection pool queuing
  const clients = []
  for (const { user, ticket } of userTickets) {
    const client = await connectHeadlessClient({ roomId: room.id, ticket, user, timeoutMs: 30000 })
    clients.push(client)
    await new Promise((r) => setTimeout(r, 15))
  }

  const writer = clients[0]
  const target = clients[1]
  const writerYText = writer.doc.getText('benchmark_a')
  const targetYText = target.doc.getText('benchmark_a')

  writerYText.insert(0, '')

  const latencies = []
  const pendingEdits = new Map()

  targetYText.observe((event) => {
    const recvTime = performance.now()
    event.changes.delta.forEach((delta) => {
      if (delta.insert && typeof delta.insert === 'string') {
        const match = delta.insert.match(/\|([0-9a-f]+)\|/)
        if (match) {
          const editId = match[1]
          if (pendingEdits.has(editId)) {
            const sendTime = pendingEdits.get(editId)
            latencies.push(recvTime - sendTime)
            pendingEdits.delete(editId)
          }
        }
      }
    })
  })

  const DURATION_MS = 5000
  const INTERVAL_MS = 200
  const startTime = performance.now()

  let count = 0
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (performance.now() - startTime >= DURATION_MS) {
        clearInterval(interval)
        setTimeout(resolve, 500)
        return
      }

      count++
      const editId = count.toString(16)
      const now = performance.now()
      pendingEdits.set(editId, now)
      writerYText.insert(writerYText.length, `|${editId}|`)
    }, INTERVAL_MS)
  })

  clients.forEach((c) => c.close())
  return computeStats(latencies)
}

async function runTestA() {
  console.log('\n--- TEST A: Sync Latency (2, 10, 25, 50 clients) ---')
  const roomSizes = [2, 10, 25, 50]
  const results = {}

  for (const size of roomSizes) {
    process.stdout.write(`Testing room size ${size}... `)
    const stats = await runSyncLatencyTestForRoomSize(size)
    results[size] = stats
    console.log(`p50: ${stats.p50}ms | p95: ${stats.p95}ms | p99: ${stats.p99}ms (samples: ${stats.count})`)
  }

  return results
}

if (require.main === module) {
  runTestA().catch(console.error)
}

module.exports = { runTestA }
