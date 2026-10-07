const http = require('http');
const https = require('https');
const Y = require('../server/node_modules/yjs');
const { WebsocketProvider } = require('../server/node_modules/y-websocket');
const WebSocket = require('../server/node_modules/ws');

global.WebSocket = WebSocket;

const targetArg = process.argv[2] || process.env.BASE_URL || 'http://localhost';
const parsedTarget = new URL(targetArg.startsWith('http') ? targetArg : `http://${targetArg}`);
const isHttps = parsedTarget.protocol === 'https:';

const BASE_URL = `${parsedTarget.protocol}//${parsedTarget.host}`;
const WS_BASE = `${isHttps ? 'wss:' : 'ws:'}//${parsedTarget.host}`;

const httpModule = isHttps ? https : http;

async function httpRequest(method, path, body = null, headers = {}) {
  const url = new URL(path, BASE_URL);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    headers: { 'Content-Type': 'application/json', ...headers },
  };

  const start = Date.now();
  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const durationMs = Date.now() - start;
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ status: res.statusCode, data: json, durationMs });
      });
    });
    req.on('error', (err) => reject({ err, durationMs: Date.now() - start }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runProdSmokeTest() {
  console.log('====================================================');
  console.log('         LIVELOOM PRODUCTION SMOKE TEST             ');
  console.log('====================================================');
  console.log(`Target HTTP URL: ${BASE_URL}`);
  console.log(`Target WS URL:   ${WS_BASE}`);
  console.log('----------------------------------------------------');

  const steps = [];

  function recordStep(name, pass, durationMs, details = '') {
    steps.push({ name, pass, durationMs, details });
    const statusStr = pass ? '✓ PASS' : '❌ FAIL';
    console.log(`${statusStr} [${durationMs.toString().padStart(4, ' ')} ms] ${name} ${details ? `(${details})` : ''}`);
  }

  try {
    // 1. /healthz
    const healthRes = await httpRequest('GET', '/healthz');
    const healthOk = healthRes.status === 200 && healthRes.data?.status === 'ok';
    recordStep('1. GET /healthz', healthOk, healthRes.durationMs, `Status ${healthRes.status}`);
    if (!healthOk) throw new Error('Healthcheck failed');

    // 2. /readyz
    const readyRes = await httpRequest('GET', '/readyz');
    const readyOk = readyRes.status === 200 && readyRes.data?.status === 'ready';
    recordStep('2. GET /readyz', readyOk, readyRes.durationMs, `Mongo: ${readyRes.data?.mongo}`);
    if (!readyOk) throw new Error('Readiness check failed');

    // 3. Signup & Login
    const email = `prod_smoke_${Date.now()}@example.com`;
    const password = 'Password123!';
    const signupRes = await httpRequest('POST', '/auth/signup', { email, password, name: 'Smoke User' });
    const signupOk = signupRes.status === 201 && !!signupRes.data?.token;
    recordStep('3a. POST /auth/signup', signupOk, signupRes.durationMs);
    if (!signupOk) throw new Error('Signup failed');

    const loginRes = await httpRequest('POST', '/auth/login', { email, password });
    const loginOk = loginRes.status === 200 && !!loginRes.data?.token;
    const token = loginRes.data?.token;
    recordStep('3b. POST /auth/login', loginOk, loginRes.durationMs);
    if (!loginOk) throw new Error('Login failed');

    // 4. Create Room
    const roomRes = await httpRequest('POST', '/rooms', { name: 'Prod Smoke Room' }, { Authorization: `Bearer ${token}` });
    const roomOk = roomRes.status === 201 && !!roomRes.data?.id;
    const roomId = roomRes.data?.id;
    recordStep('4. POST /rooms', roomOk, roomRes.durationMs, `RoomId: ${roomId}`);
    if (!roomOk) throw new Error('Room creation failed');

    // 5. Get WS Ticket
    const ticketRes = await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${token}` });
    const ticketOk = (ticketRes.status === 200 || ticketRes.status === 201) && !!ticketRes.data?.ticket;
    const ticket = ticketRes.data?.ticket;
    recordStep('5. POST /rooms/:id/tickets', ticketOk, ticketRes.durationMs);
    if (!ticketOk) throw new Error('Ticket acquisition failed');

    // 6. WebSocket Connect
    const wsStart = Date.now();
    const docA = new Y.Doc();
    const providerA = new WebsocketProvider(`${WS_BASE}/ws`, roomId, docA, { params: { ticket, roomId } });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS connection timeout')), 10000);
      providerA.on('status', (e) => {
        if (e.status === 'connected') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const wsDuration = Date.now() - wsStart;
    recordStep('6. WebSocket Connection', true, wsDuration, 'Connected cleanly');

    // 7. Yjs Live Sync (Client A edit -> Client B receive)
    const syncStart = Date.now();
    const ticketB = (await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${token}` })).data.ticket;
    const docB = new Y.Doc();
    const providerB = new WebsocketProvider(`${WS_BASE}/ws`, roomId, docB, { params: { ticket: ticketB, roomId } });

    await new Promise((resolve) => {
      providerB.on('status', (e) => { if (e.status === 'connected') resolve(); });
    });

    const testMessage = `LiveSync_Verified_${Date.now()}`;
    const textA = docA.getText('codemirror');
    const textB = docB.getText('codemirror');

    textA.insert(0, testMessage);

    let syncPass = false;
    const syncDeadline = Date.now() + 10000;
    while (Date.now() < syncDeadline) {
      if (textB.toString() === testMessage) {
        syncPass = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const syncDuration = Date.now() - syncStart;
    recordStep('7. Yjs Real-Time Live Sync (A -> B)', syncPass, syncDuration, `Length: ${textB.toString().length}`);

    providerA.destroy();
    providerB.destroy();

    if (!syncPass) throw new Error('Live sync failed');

    console.log('----------------------------------------------------');
    console.log('🎉 ALL PRODUCTION SMOKE TEST STEPS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (err) {
    console.log('----------------------------------------------------');
    console.error('❌ PRODUCTION SMOKE TEST FAILED:', err.message || err);
    console.log('====================================================');
    process.exit(1);
  }
}

runProdSmokeTest();
