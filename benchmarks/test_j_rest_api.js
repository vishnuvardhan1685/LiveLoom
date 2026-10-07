const autocannon = require('autocannon')
const { createTestUser, createTestRoom, API_BASE } = require('./helpers')

async function runAutocannonTest({ url, method = 'GET', headers = {}, body = null, connections = 10, duration = 5 }) {
  try {
    const result = await autocannon({
      url,
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      connections,
      duration,
    })

    const reqPerSec = typeof result?.requests?.average === 'number'
      ? Number(result.requests.average.toFixed(2))
      : (typeof result?.requests?.mean === 'number' ? Number(result.requests.mean.toFixed(2)) : 0)

    const p50 = typeof result?.latency?.p50 === 'number' ? Number(result.latency.p50.toFixed(2)) : 0
    const p90 = typeof result?.latency?.p90 === 'number' ? Number(result.latency.p90.toFixed(2)) : 0
    const p97_5 = typeof result?.latency?.p97_5 === 'number' ? Number(result.latency.p97_5.toFixed(2)) : 0
    const p99 = typeof result?.latency?.p99 === 'number' ? Number(result.latency.p99.toFixed(2)) : 0

    return {
      reqPerSec,
      p50,
      p90,
      p97_5,
      p99,
      errors: result?.errors || 0,
      timeouts: result?.timeouts || 0,
    }
  } catch (err) {
    const errMsg = err?.message || String(err)
    console.error(`[Autocannon Error] ${url}: ${errMsg}`)
    return {
      reqPerSec: 0,
      p50: 0,
      p90: 0,
      p97_5: 0,
      p99: 0,
      errors: 1,
      timeouts: 0,
      errorMsg: errMsg,
    }
  }
}

async function runTestJ() {
  console.log('\n--- TEST J: REST API Throughput & Latency (autocannon) ---')

  const user = await createTestUser('user_j')
  const room = await createTestRoom(user.token, 'REST API Room')

  const endpoints = [
    {
      name: 'POST /auth/login',
      url: `${API_BASE}/auth/login`,
      method: 'POST',
      body: { email: user.email, password: user.password },
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'GET /rooms',
      url: `${API_BASE}/rooms`,
      method: 'GET',
      headers: { Authorization: `Bearer ${user.token}` },
    },
    {
      name: 'POST /rooms (create room)',
      url: `${API_BASE}/rooms`,
      method: 'POST',
      body: { name: 'Autocannon Room' },
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    },
    {
      name: 'POST /rooms/:id/ws-ticket',
      url: `${API_BASE}/rooms/${room.id}/ws-ticket`,
      method: 'POST',
      body: {},
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    },
  ]

  const connectionLevels = [10, 50, 200]
  const results = {}

  for (const ep of endpoints) {
    results[ep.name] = {}
    console.log(`\nAuditing endpoint: ${ep.name}`)

    for (const conns of connectionLevels) {
      process.stdout.write(`  Connections: ${conns}... `)
      const res = await runAutocannonTest({
        url: ep.url,
        method: ep.method,
        headers: ep.headers,
        body: ep.body,
        connections: conns,
        duration: 4,
      })
      results[ep.name][conns] = res
      console.log(`Req/s: ${res.reqPerSec} | p50: ${res.p50}ms | p90: ${res.p90}ms | p97_5: ${res.p97_5}ms | p99: ${res.p99}ms`)
    }
  }

  return results
}

if (require.main === module) {
  runTestJ().catch(console.error)
}

module.exports = { runTestJ }
