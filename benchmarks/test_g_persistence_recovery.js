const { spawn } = require('child_process')
const path = require('path')
const Y = require('yjs')
const { performance } = require('perf_hooks')
const { createTestUser, createTestRoom, getWsTicket, connectHeadlessClient } = require('./helpers')

// Simple deterministic Mulberry32 PRNG
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function runDeterministicCompactionTest(opsCount = 10000) {
  const rng = mulberry32(42)
  const docNoGC = new Y.Doc({ gc: false })
  const docGC = new Y.Doc({ gc: true })

  const textNoGC = docNoGC.getText('t')
  const textGC = docGC.getText('t')

  for (let i = 0; i < opsCount; i++) {
    const opType = rng()
    if (opType < 0.6 || textNoGC.length === 0) {
      const char = String.fromCharCode(97 + Math.floor(rng() * 26))
      const pos = Math.floor(rng() * (textNoGC.length + 1))
      textNoGC.insert(pos, char)
      textGC.insert(pos, char)
    } else {
      const pos = Math.floor(rng() * textNoGC.length)
      const len = Math.min(1 + Math.floor(rng() * 3), textNoGC.length - pos)
      textNoGC.delete(pos, len)
      textGC.delete(pos, len)
    }
  }

  const bytesNoGC = Y.encodeStateAsUpdate(docNoGC).byteLength
  const bytesGC = Y.encodeStateAsUpdate(docGC).byteLength

  docNoGC.destroy()
  docGC.destroy()

  return {
    opsCount,
    bytesNoGC,
    bytesGC,
    compactionRatio: Number((((bytesNoGC - bytesGC) / bytesNoGC) * 100).toFixed(2)),
  }
}

async function runKill9DataLossTest() {
  const serverPath = path.join(__dirname, '../server/src/index.js')
  const serverProc = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '../server'),
    env: { ...process.env, PORT: '4002' },
    stdio: 'ignore',
  })

  await new Promise((r) => setTimeout(r, 3500))

  const WS_4002 = 'ws://localhost:4002/ws'

  try {
    const owner = await createTestUser('owner_g_kill')
    const room = await createTestRoom(owner.token, 'Kill9 Test Room')
    const ticket = await getWsTicket(owner.token, room.id)

    const client = await connectHeadlessClient({
      roomId: room.id,
      ticket,
      user: owner,
      wsBaseUrl: WS_4002,
    })

    const ytext = client.doc.getText('kill_doc')

    let charsSent = 0

    for (let i = 0; i < 100; i++) {
      const chunk = `edit_${i}_`
      ytext.insert(ytext.length, chunk)
      charsSent += chunk.length
      await new Promise((r) => setTimeout(r, 10))

      if (i === 40) {
        // Abruptly SIGKILL the server process mid-typing
        try { serverProc.kill('SIGKILL') } catch (_) {}
      }
    }

    try { client.close() } catch (_) {}

    // Restart server process on 4002 to read persistent Mongo state
    const restartedProc = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '../server'),
      env: { ...process.env, PORT: '4002' },
      stdio: 'ignore',
    })

    await new Promise((r) => setTimeout(r, 3500))

    try {
      const restoreStart = performance.now()
      const ticket2 = await getWsTicket(owner.token, room.id)
      const restoredClient = await connectHeadlessClient({
        roomId: room.id,
        ticket: ticket2,
        user: owner,
        wsBaseUrl: WS_4002,
      })
      const restoreTimeMs = performance.now() - restoreStart

      const restoredText = restoredClient.doc.getText('kill_doc').toString()
      const charsSaved = restoredText.length
      const charsLost = Math.max(0, charsSent - charsSaved)

      restoredClient.close()

      return {
        restoreTimeMs: Number(restoreTimeMs.toFixed(2)),
        charsSent,
        charsSaved,
        charsLost,
        unflushedDataSaved: charsLost === 0,
      }
    } finally {
      try { restartedProc.kill('SIGKILL') } catch (_) {}
    }
  } catch (err) {
    try { serverProc.kill('SIGKILL') } catch (_) {}
    return {
      restoreTimeMs: 0,
      charsSent: 0,
      charsSaved: 0,
      charsLost: 0,
      unflushedDataSaved: false,
    }
  }
}

async function runPersistenceRecoveryTest() {
  const compaction = await runDeterministicCompactionTest(10000)
  const killTest = await runKill9DataLossTest()

  return {
    restoreTimeMs: killTest.restoreTimeMs,
    charsSent: killTest.charsSent,
    charsSaved: killTest.charsSaved,
    charsLost: killTest.charsLost,
    dataLossUnflushedSaved: killTest.unflushedDataSaved,
    opsCount: compaction.opsCount,
    sizeNoGCBytes: compaction.bytesNoGC,
    sizeGCBytes: compaction.bytesGC,
    compactionRatio: compaction.compactionRatio,
  }
}

async function runTestG() {
  console.log('\n--- TEST G: Persistence & Recovery ---')
  const res = await runPersistenceRecoveryTest()
  console.log(`Room Restore Time from Mongo: ${res.restoreTimeMs}ms`)
  console.log(`Deterministic 10k Ops Size without GC: ${(res.sizeNoGCBytes / 1024).toFixed(2)} KB | with GC: ${(res.sizeGCBytes / 1024).toFixed(2)} KB`)
  console.log(`Deterministic Compaction Reduction: ${res.compactionRatio}%`)
  console.log(`Kill -9 Test: Sent ${res.charsSent} chars | Saved ${res.charsSaved} chars | Lost ${res.charsLost} chars`)
  return res
}

if (require.main === module) {
  runTestG().catch(console.error)
}

module.exports = { runTestG }
