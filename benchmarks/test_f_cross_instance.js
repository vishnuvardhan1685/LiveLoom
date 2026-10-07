const { spawn } = require('child_process')
const path = require('path')
const { performance } = require('perf_hooks')
const { createTestUser, createTestRoom, getWsTicket, connectHeadlessClient, computeStats } = require('./helpers')

async function runCrossInstanceTest() {
  const serverPath = path.join(__dirname, '../server/src/index.js')
  const serverB = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '../server'),
    env: { ...process.env, PORT: '4001' },
    stdio: 'pipe',
  })

  serverB.stdout.on('data', (d) => process.stdout.write(`[ServerB] ${d.toString()}`))
  serverB.stderr.on('data', (d) => process.stderr.write(`[ServerB ERR] ${d.toString()}`))

  // Wait 4 seconds for Instance B to initialize, connect to Mongo & Redis, and listen on 4001
  await new Promise((r) => setTimeout(r, 4000))

  try {
    const owner = await createTestUser('owner_f')
    const userB = await createTestUser('user_f_instB')
    const room = await createTestRoom(owner.token, 'Cross Instance Room')

    const ticketA = await getWsTicket(owner.token, room.id)
    const ticketB = await getWsTicket(owner.token, room.id)

    // Connect Client A to Server A (ws://localhost:4000/ws)
    const clientA = await connectHeadlessClient({
      roomId: room.id,
      ticket: ticketA,
      user: owner,
      wsBaseUrl: 'ws://localhost:4000/ws',
    })

    // Connect Client B to Server B (ws://localhost:4001/ws)
    const clientB = await connectHeadlessClient({
      roomId: room.id,
      ticket: ticketB,
      user: userB,
      wsBaseUrl: 'ws://localhost:4001/ws',
    })

    const textA = clientA.doc.getText('cross_instance')
    const textB = clientB.doc.getText('cross_instance')

    const latencies = []
    const pending = new Map()

    textB.observe((event) => {
      const now = performance.now()
      event.changes.delta.forEach((d) => {
        if (d.insert && typeof d.insert === 'string') {
          const match = d.insert.match(/\|([0-9a-f]+)\|/)
          if (match && pending.has(match[1])) {
            latencies.push(now - pending.get(match[1]))
            pending.delete(match[1])
          }
        }
      })
    })

    for (let i = 0; i < 200; i++) {
      const id = i.toString(16)
      pending.set(id, performance.now())
      textA.insert(textA.length, `|${id}|`)
      await new Promise((r) => setTimeout(r, 20))
    }

    await new Promise((r) => setTimeout(r, 500))

    const awarenessAState = clientA.awareness.getStates()
    const awarenessBState = clientB.awareness.getStates()
    const awarenessRelayed = awarenessAState.size > 1 && awarenessBState.size > 1

    clientA.close()
    clientB.close()

    const stats = computeStats(latencies)
    return {
      crossLatencyP50: stats.p50,
      crossLatencyP95: stats.p95,
      crossLatencyP99: stats.p99,
      awarenessRelayed,
      sampleCount: stats.count,
    }
  } finally {
    try { serverB.kill('SIGKILL') } catch (_) {}
    await new Promise((r) => setTimeout(r, 500))
  }
}

async function runTestF() {
  console.log('\n--- TEST F: Cross-Instance Redis Synchronization ---')
  const res = await runCrossInstanceTest()
  console.log(
    `Cross-Instance Latency p50: ${res.crossLatencyP50}ms | p95: ${res.crossLatencyP95}ms | p99: ${res.crossLatencyP99}ms`
  )
  console.log(`Awareness Relayed Across Instances: ${res.awarenessRelayed ? 'YES' : 'NO (Known Gap)'}`)
  return res
}

if (require.main === module) {
  runTestF().catch(console.error)
}

module.exports = { runTestF }
