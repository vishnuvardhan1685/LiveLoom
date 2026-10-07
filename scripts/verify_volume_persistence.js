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

async function verifyPersistence() {
  console.log('--- VERIFYING VOLUME PERSISTENCE ACROSS DOCKER DOWN/UP ---');

  const email = `persist_${Date.now()}@example.com`;
  const password = 'Password123!';
  const user = await httpRequest('POST', '/auth/signup', { email, password, name: 'Persist Tester' });
  const room = await httpRequest('POST', '/rooms', { name: 'Persistence Room' }, { Authorization: `Bearer ${user.data.token}` });
  const roomId = room.data.id;

  const ticket = (await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${user.data.token}` })).data.ticket;

  const doc1 = new Y.Doc();
  const provider1 = new WebsocketProvider(`${WS_BASE}/ws`, roomId, doc1, { params: { ticket, roomId } });

  await new Promise((resolve) => {
    provider1.on('status', (e) => { if (e.status === 'connected') resolve(); });
  });

  const ytext1 = doc1.getText('codemirror');
  ytext1.insert(0, 'Persistent document content in Mongo volume.');

  // Wait 4s for snapshot debounce flush to MongoDB
  console.log('[1/3] Waiting 4s for snapshot flush to MongoDB volume...');
  await new Promise((r) => setTimeout(r, 4000));
  provider1.destroy();

  console.log('[2/3] Taking down Docker Compose stack (docker compose stop)...');
  execSync('docker compose stop', { stdio: 'inherit' });

  console.log('[3/3] Bringing back Docker Compose stack (docker compose up -d)...');
  execSync('docker compose up -d', { stdio: 'inherit' });
  await new Promise((r) => setTimeout(r, 3000));

  // Log in existing user
  const loginRes = await httpRequest('POST', '/auth/login', { email, password });
  const newTicket = (await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${loginRes.data.token}` })).data.ticket;

  const doc2 = new Y.Doc();
  const provider2 = new WebsocketProvider(`${WS_BASE}/ws`, roomId, doc2, { params: { ticket: newTicket, roomId } });

  await new Promise((resolve) => {
    provider2.on('status', (e) => { if (e.status === 'connected') resolve(); });
  });

  // Wait 1s for sync
  await new Promise((r) => setTimeout(r, 1000));

  const ytext2 = doc2.getText('codemirror');
  console.log(`Recovered text from MongoDB volume after restart: "${ytext2.toString()}"`);

  if (ytext2.toString() === 'Persistent document content in Mongo volume.') {
    console.log('🎉 VOLUME PERSISTENCE VERIFIED SUCCESSFULLY!');
  } else {
    throw new Error(`Data persistence failed! Got: "${ytext2.toString()}"`);
  }

  provider2.destroy();
}

verifyPersistence().catch((err) => {
  console.error('❌ Persistence verification failed:', err);
  try { execSync('docker compose up -d'); } catch (_) {}
  process.exit(1);
});
