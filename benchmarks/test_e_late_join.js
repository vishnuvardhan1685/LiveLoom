const Y = require('yjs')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')
const { performance } = require('perf_hooks')
const { createTestUser, createTestRoom, getWsTicket, connectHeadlessClient, computeStats, WS_BASE } = require('./helpers')

async function measureSingleDocSync(roomId, ownerToken) {
  const lateJoiner = await createTestUser('late_joiner')
  const ticketLate = await getWsTicket(ownerToken, roomId)

  let bytesTransferred = 0
  const connectStart = performance.now()

  const lateDoc = new Y.Doc()
  const provider = new WebsocketProvider(WS_BASE, roomId, lateDoc, {
    WebSocketPolyfill: WebSocket,
    params: { ticket: ticketLate, roomId },
    disableBc: true,
  })

  if (provider.ws) {
    provider.ws.on('message', (data) => {
      bytesTransferred += data.length || data.byteLength || 0
    })
  }

  await new Promise((resolve) => {
    provider.on('sync', (isSynced) => {
      if (isSynced) resolve()
    })
  })

  const syncTimeMs = performance.now() - connectStart

  provider.destroy()
  lateDoc.destroy()

  return { syncTimeMs, bytesTransferred }
}

async function measureLateJoinDocSize(targetSizeKB, sampleCount = 5) {
  const owner = await createTestUser('owner_e')
  const room = await createTestRoom(owner.token, `Late Join Size ${targetSizeKB}KB`)
  const ticketInit = await getWsTicket(owner.token, room.id)

  const initClient = await connectHeadlessClient({ roomId: room.id, ticket: ticketInit, user: owner })
  const ytext = initClient.doc.getText('main_doc')

  const chunkSize = 1024
  const chunk = 'x'.repeat(chunkSize)
  for (let c = 0; c < targetSizeKB; c++) {
    ytext.insert(ytext.length, chunk)
  }

  await new Promise((r) => setTimeout(r, 500))
  initClient.close()

  // Warmup sample
  await measureSingleDocSync(room.id, owner.token)

  const times = []
  let bytes = 0
  for (let s = 0; s < sampleCount; s++) {
    const res = await measureSingleDocSync(room.id, owner.token)
    times.push(res.syncTimeMs)
    bytes = res.bytesTransferred
  }

  const stats = computeStats(times)
  return {
    targetSizeKB,
    syncTimeMs: stats.median,
    minMs: stats.min,
    maxMs: stats.max,
    bytesTransferred: bytes,
    kbTransferred: Number((bytes / 1024).toFixed(2)),
  }
}

async function measureLateJoinFilesCount(fileCount, sampleCount = 5) {
  const owner = await createTestUser('owner_ef')
  const room = await createTestRoom(owner.token, `Late Join Files ${fileCount}`)
  const ticketInit = await getWsTicket(owner.token, room.id)

  const initClient = await connectHeadlessClient({ roomId: room.id, ticket: ticketInit, user: owner })
  const filesMap = initClient.doc.getMap('files')

  initClient.doc.transact(() => {
    for (let f = 0; f < fileCount; f++) {
      const fileText = new Y.Text()
      fileText.insert(0, `// File content ${f}\nconsole.log("Hello from file ${f}");`)
      filesMap.set(`src/file_${f}.js`, fileText)
    }
  })

  await new Promise((r) => setTimeout(r, 500))
  initClient.close()

  // Warmup sample
  await measureSingleDocSync(room.id, owner.token)

  const times = []
  for (let s = 0; s < sampleCount; s++) {
    const res = await measureSingleDocSync(room.id, owner.token)
    times.push(res.syncTimeMs)
  }

  const stats = computeStats(times)
  return {
    fileCount,
    syncTimeMs: stats.median,
    minMs: stats.min,
    maxMs: stats.max,
  }
}

async function runTestE() {
  console.log('\n--- TEST E: Late-Join / Initial Sync (Doc Sizes & File Counts) ---')
  const sizes = [10, 100, 1000, 5000]
  const sizeResults = []

  for (const sz of sizes) {
    process.stdout.write(`Testing doc size ${sz}KB (N=5 samples)... `)
    const res = await measureLateJoinDocSize(sz, 5)
    sizeResults.push(res)
    console.log(`Median Sync Time: ${res.syncTimeMs}ms (range: ${res.minMs}-${res.maxMs}ms) | Transferred: ${res.kbTransferred} KB`)
  }

  const fileCounts = [1, 20, 100]
  const fileResults = []

  for (const fc of fileCounts) {
    process.stdout.write(`Testing file count ${fc} (N=5 samples)... `)
    const res = await measureLateJoinFilesCount(fc, 5)
    fileResults.push(res)
    console.log(`Median Sync Time: ${res.syncTimeMs}ms (range: ${res.minMs}-${res.maxMs}ms)`)
  }

  return { sizeResults, fileResults }
}

if (require.main === module) {
  runTestE().catch(console.error)
}

module.exports = { runTestE }
