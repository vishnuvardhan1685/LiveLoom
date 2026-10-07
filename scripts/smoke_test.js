const http = require('http');
const WebSocket = require('../server/node_modules/ws');

const BASE_URL = process.env.TARGET_URL || 'http://localhost';
const WS_BASE = process.env.TARGET_WS_URL || 'ws://localhost';

async function httpRequest(method, path, body = null, headers = {}) {
  const url = new URL(path, BASE_URL);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSmokeTest() {
  console.log('--- LIVE LOOM CONTAINER SMOKE TEST ---');
  console.log(`Targeting BASE_URL=${BASE_URL}`);

  // 1. /healthz
  console.log('[1/6] Testing GET /healthz ...');
  const healthRes = await httpRequest('GET', '/healthz');
  if (healthRes.status !== 200 || healthRes.data?.status !== 'ok') {
    throw new Error(`Healthcheck failed: ${JSON.stringify(healthRes)}`);
  }
  console.log('✓ /healthz passed:', healthRes.data);

  // 2. /readyz
  console.log('[2/6] Testing GET /readyz ...');
  const readyRes = await httpRequest('GET', '/readyz');
  if (readyRes.status !== 200 || readyRes.data?.status !== 'ready') {
    throw new Error(`Readiness check failed: ${JSON.stringify(readyRes)}`);
  }
  console.log('✓ /readyz passed:', readyRes.data);

  // 3. Auth signup
  console.log('[3/6] Testing POST /auth/signup ...');
  const email = `smoke_${Date.now()}@example.com`;
  const signupRes = await httpRequest('POST', '/auth/signup', {
    email,
    password: 'Password123!',
    name: 'Smoke Tester',
  });
  if (signupRes.status !== 201 || !signupRes.data?.token) {
    throw new Error(`Signup failed: ${JSON.stringify(signupRes)}`);
  }
  const token = signupRes.data.token;
  console.log('✓ Auth signup passed. Token received.');

  // 4. Create Room
  console.log('[4/6] Testing POST /rooms ...');
  const roomRes = await httpRequest('POST', '/rooms', { name: 'Smoke Room' }, { Authorization: `Bearer ${token}` });
  if (roomRes.status !== 201 || !roomRes.data?.id) {
    throw new Error(`Room creation failed: ${JSON.stringify(roomRes)}`);
  }
  const roomId = roomRes.data.id;
  console.log(`✓ Room created successfully. RoomId=${roomId}`);

  // 5. Get WS Ticket
  console.log('[5/6] Testing POST /rooms/:id/tickets ...');
  const ticketRes = await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${token}` });
  if ((ticketRes.status !== 200 && ticketRes.status !== 201) || !ticketRes.data?.ticket) {
    throw new Error(`Ticket acquisition failed: ${JSON.stringify(ticketRes)}`);
  }
  const ticket = ticketRes.data.ticket;
  console.log('✓ WS ticket acquired.');

  // 6. Connect WebSocket
  console.log('[6/6] Testing WebSocket Connection ...');
  const wsUrl = `${WS_BASE}/ws?ticket=${ticket}&roomId=${roomId}`;
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.on('open', () => {
      console.log('✓ WebSocket connected cleanly via Nginx proxy.');
      clearTimeout(timer);
      ws.close(1000, 'Smoke test completed');
      resolve();
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  console.log('🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY!');
}

runSmokeTest().catch((err) => {
  console.error('❌ SMOKE TEST FAILED:', err);
  process.exit(1);
});
