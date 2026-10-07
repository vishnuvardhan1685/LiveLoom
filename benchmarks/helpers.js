const os = require('os')
const http = require('http')
const { monitorEventLoopDelay } = require('perf_hooks')
const Y = require('yjs')
const WebSocket = require('ws')
const { WebsocketProvider } = require('y-websocket')

const API_BASE = process.env.API_BASE || 'http://localhost:4000'
const WS_BASE = process.env.WS_BASE || 'ws://localhost:4000/ws'

function getSystemInfo() {
  const cpus = os.cpus()
  return {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpuModel: cpus[0] ? cpus[0].model : 'Unknown CPU',
    cpuCores: cpus.length,
    ramGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
    nodeVersion: process.version,
  }
}

function requestJson(urlStr, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const reqHeaders = { 'Content-Type': 'application/json', ...headers }
    const reqData = body ? JSON.stringify(body) : null
    if (reqData) reqHeaders['Content-Length'] = Buffer.byteLength(reqData)

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {}
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: json })
          } else {
            reject({ statusCode: res.statusCode, error: json })
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, error: data })
        }
      })
    })

    req.on('error', reject)
    if (reqData) req.write(reqData)
    req.end()
  })
}

async function createTestUser(emailPrefix = 'bench') {
  const name = `Bench User ${Math.floor(Math.random() * 100000)}`
  const email = `${emailPrefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@bench.local`
  const password = 'Password123!'

  const { data } = await requestJson(`${API_BASE}/auth/signup`, 'POST', { name, email, password })
  return { id: data.user.id, name, email, password, token: data.token }
}

async function createTestRoom(token, name = 'Bench Room', maxUsers = 2000) {
  const { data } = await requestJson(`${API_BASE}/rooms`, 'POST', { name, maxUsers }, { Authorization: `Bearer ${token}` })
  return data
}

async function createRoomInvite(ownerToken, roomId, maxUses = 2000) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await requestJson(
    `${API_BASE}/rooms/${roomId}/invites`,
    'POST',
    { role: 'editor', expiresAt, maxUses },
    { Authorization: `Bearer ${ownerToken}` }
  )
  return data.token
}

async function redeemInvite(userToken, inviteToken) {
  const { data } = await requestJson(
    `${API_BASE}/invites/${inviteToken}`,
    'POST',
    {},
    { Authorization: `Bearer ${userToken}` }
  )
  return data
}

async function createAndJoinUser(ownerToken, room, inviteToken, prefix = 'peer') {
  const user = await createTestUser(prefix)
  if (inviteToken) {
    await redeemInvite(user.token, inviteToken)
  }
  const ticket = await getWsTicket(user.token, room.id)
  return { user, ticket }
}

async function prepareRoomClients(owner, roomSize, roomNamePrefix = 'bench') {
  const room = await createTestRoom(owner.token, `${roomNamePrefix}_${roomSize}`, 2000)
  const inviteToken = await createRoomInvite(owner.token, room.id, 2000)

  const userTickets = []
  const ownerTicket = await getWsTicket(owner.token, room.id)
  userTickets.push({ user: owner, ticket: ownerTicket })

  // Process invite redemption in chunks of 5 to avoid MongoDB room.save concurrency conflicts
  const CHUNK_SIZE = 5
  for (let i = 1; i < roomSize; i += CHUNK_SIZE) {
    const chunkPromises = []
    for (let j = i; j < Math.min(i + CHUNK_SIZE, roomSize); j++) {
      chunkPromises.push(createAndJoinUser(owner.token, room, inviteToken, `u_${j}`))
    }
    const chunkResults = await Promise.all(chunkPromises)
    userTickets.push(...chunkResults)
  }

  return { room, userTickets }
}

async function getWsTicket(token, roomId) {
  const { data } = await requestJson(`${API_BASE}/rooms/${roomId}/ws-ticket`, 'POST', {}, { Authorization: `Bearer ${token}` })
  return data.ticket
}

function connectHeadlessClient({ roomId, ticket, user, wsBaseUrl = WS_BASE, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc()
    const provider = new WebsocketProvider(wsBaseUrl, roomId, doc, {
      WebSocketPolyfill: WebSocket,
      params: { ticket, roomId },
      disableBc: true,
    })

    if (user) {
      provider.awareness.setLocalStateField('user', {
        id: user.id,
        name: user.name,
        role: user.role || 'editor',
        color: '#ff516a',
        status: 'active',
      })
    }

    const timer = setTimeout(() => {
      provider.destroy()
      doc.destroy()
      reject(new Error(`WS Connect timeout for room ${roomId}`))
    }, timeoutMs)

    provider.on('sync', (isSynced) => {
      if (isSynced) {
        clearTimeout(timer)
        resolve({
          doc,
          provider,
          awareness: provider.awareness,
          close: () => {
            provider.destroy()
            doc.destroy()
          },
        })
      }
    })

    provider.on('connection-error', (err) => {
      clearTimeout(timer)
      provider.destroy()
      doc.destroy()
      reject(err)
    })
  })
}

function computeStats(samples) {
  if (!samples || samples.length === 0) {
    return { count: 0, min: 0, max: 0, median: 0, p50: 0, p95: 0, p99: 0, mean: 0, spread: 0 }
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const count = sorted.length
  const sum = sorted.reduce((acc, val) => acc + val, 0)

  const getPercentile = (p) => {
    const idx = Math.floor((p / 100) * count)
    return sorted[Math.min(idx, count - 1)]
  }

  const min = sorted[0]
  const max = sorted[count - 1]
  const p50 = getPercentile(50)
  const p95 = getPercentile(95)
  const p99 = getPercentile(99)
  const mean = sum / count
  const spread = max - min

  return {
    count,
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    median: Number(p50.toFixed(2)),
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    spread: Number(spread.toFixed(2)),
  }
}

function startEventLoopMonitor() {
  const histogram = monitorEventLoopDelay({ resolution: 1 })
  histogram.enable()
  return {
    stop: () => {
      histogram.disable()
      return {
        minMs: (histogram.min / 1e6).toFixed(2),
        maxMs: (histogram.max / 1e6).toFixed(2),
        meanMs: (histogram.mean / 1e6).toFixed(2),
        p50Ms: (histogram.percentile(50) / 1e6).toFixed(2),
        p95Ms: (histogram.percentile(95) / 1e6).toFixed(2),
        p99Ms: (histogram.percentile(99) / 1e6).toFixed(2),
      }
    },
  }
}

module.exports = {
  API_BASE,
  WS_BASE,
  getSystemInfo,
  requestJson,
  createTestUser,
  createTestRoom,
  createRoomInvite,
  redeemInvite,
  createAndJoinUser,
  prepareRoomClients,
  getWsTicket,
  connectHeadlessClient,
  computeStats,
  startEventLoopMonitor,
}
