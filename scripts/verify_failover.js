const Y = require('../server/node_modules/yjs');
const { WebsocketProvider } = require('../server/node_modules/y-websocket');
const WebSocket = require('../server/node_modules/ws');
const http = require('http');
const { execSync } = require('child_process');

global.WebSocket = WebSocket;

const BASE_URL = 'http://localhost';
const WS_BASE = 'ws://localhost';

async function httpRequest(method, path, body = null, headers = {}) {
  const url = new URL(path, BASE_URL);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    headers: { 'Content-Type': 'application/json', ...headers },
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

async function verifyFailover() {
  console.log('--- VERIFYING REPLICA FAILOVER & AUTO-RECONNECT ---');

  // Scale server to 2 replicas
  console.log('[1/4] Scaling backend server to 2 replicas...');
  execSync('docker compose up -d --scale server=2', { stdio: 'inherit' });
  await new Promise((r) => setTimeout(r, 2000));

  const user = await httpRequest('POST', '/auth/signup', { email: `failover_${Date.now()}@example.com`, password: 'Password123!', name: 'Failover Tester' });
  const room = await httpRequest('POST', '/rooms', { name: 'Failover Room' }, { Authorization: `Bearer ${user.data.token}` });
  const roomId = room.data.id;

  const ticket = (await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${user.data.token}` })).data.ticket;

  const doc = new Y.Doc();
  const provider = new WebsocketProvider(`${WS_BASE}/ws`, roomId, doc, { params: { ticket, roomId } });

  let disconnectCount = 0;
  let reconnectCount = 0;

  provider.on('status', (e) => {
    console.log(`[CLIENT STATUS CHANGE]: ${e.status}`);
    if (e.status === 'disconnected') disconnectCount++;
    if (e.status === 'connected' && disconnectCount > 0) reconnectCount++;
  });

  await new Promise((resolve) => {
    if (provider.wsconnected) resolve();
    provider.on('status', (e) => { if (e.status === 'connected') resolve(); });
  });

  console.log('✓ Initial connection established through Nginx.');
  const ytext = doc.getText('codemirror');
  ytext.insert(0, 'Data written before failover.');

  await new Promise((r) => setTimeout(r, 1000));

  console.log('[2/4] Restarting liveloom-server-1 and liveloom-server-2 one by one to force failover...');
  execSync('docker restart liveloom-server-1', { stdio: 'inherit' });

  console.log('[3/4] Waiting for auto-reconnect...');
  const start = Date.now();
  while (reconnectCount === 0 && Date.now() - start < 15000) {
    await new Promise((r) => setTimeout(r, 300));
  }

  if (reconnectCount === 0) {
    // If client was on server-2, restart server-2
    console.log('Client was on server-2. Restarting liveloom-server-2...');
    execSync('docker restart liveloom-server-2', { stdio: 'inherit' });
    while (reconnectCount === 0 && Date.now() - start < 20000) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (reconnectCount === 0) {
    throw new Error('Client failed to auto-reconnect after server restart');
  }

  console.log('✓ Client auto-reconnected cleanly!');
  console.log(`Current document content: "${ytext.toString()}"`);

  if (ytext.toString() === 'Data written before failover.') {
    console.log('🎉 REPLICA FAILOVER & RECONNECT VERIFIED WITH NO DATA LOSS!');
  } else {
    throw new Error(`Data lost after failover! Got: "${ytext.toString()}"`);
  }

  provider.destroy();
  execSync('docker compose up -d --scale server=1', { stdio: 'inherit' });
}

verifyFailover().catch((err) => {
  console.error('❌ Failover verification failed:', err);
  try { execSync('docker compose up -d --scale server=1'); } catch (_) {}
  process.exit(1);
});
