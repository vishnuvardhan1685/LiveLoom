const Y = require('../server/node_modules/yjs');
const { WebsocketProvider } = require('../server/node_modules/y-websocket');
const WebSocket = require('../server/node_modules/ws');
const http = require('http');

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

async function verifyLiveSync() {
  console.log('--- VERIFYING LIVE MULTI-CLIENT SYNC VIA NGINX ---');
  // 1. Signup & create room
  const user1 = await httpRequest('POST', '/auth/signup', { email: `sync1_${Date.now()}@example.com`, password: 'Password123!', name: 'User 1' });
  const user2 = await httpRequest('POST', '/auth/signup', { email: `sync2_${Date.now()}@example.com`, password: 'Password123!', name: 'User 2' });

  const room = await httpRequest('POST', '/rooms', { name: 'Sync Verification Room' }, { Authorization: `Bearer ${user1.data.token}` });
  const roomId = room.data.id;

  const ticket1 = (await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${user1.data.token}` })).data.ticket;
  const ticket2 = (await httpRequest('POST', `/rooms/${roomId}/tickets`, null, { Authorization: `Bearer ${user2.data.token}` })).data.ticket;

  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  const provider1 = new WebsocketProvider(`${WS_BASE}/ws`, roomId, doc1, { params: { ticket: ticket1, roomId } });
  const provider2 = new WebsocketProvider(`${WS_BASE}/ws`, roomId, doc2, { params: { ticket: ticket2, roomId } });

  await new Promise((resolve) => {
    let synced1 = false;
    let synced2 = false;
    provider1.on('status', (e) => { if (e.status === 'connected') synced1 = true; if (synced1 && synced2) resolve(); });
    provider2.on('status', (e) => { if (e.status === 'connected') synced2 = true; if (synced1 && synced2) resolve(); });
  });

  console.log('✓ Provider 1 and Provider 2 connected via WebSocket through Nginx.');

  // Wait 1s for Yjs handshake
  await new Promise((r) => setTimeout(r, 1000));

  // Client 1 inserts text into 'codemirror' Y.Text
  const ytext1 = doc1.getText('codemirror');
  const ytext2 = doc2.getText('codemirror');

  console.log('Client 1 inserting text: "Hello LiveLoom Containerized!"');
  ytext1.insert(0, 'Hello LiveLoom Containerized!');

  // Wait 1s for sync
  await new Promise((r) => setTimeout(r, 1000));

  console.log(`Client 2 content: "${ytext2.toString()}"`);

  if (ytext2.toString() === 'Hello LiveLoom Containerized!') {
    console.log('🎉 LIVE MULTI-CLIENT SYNC VERIFIED SUCCESSFULLY!');
  } else {
    throw new Error(`Sync verification failed! Expected "Hello LiveLoom Containerized!", got "${ytext2.toString()}"`);
  }

  provider1.destroy();
  provider2.destroy();
}

verifyLiveSync().catch((err) => {
  console.error('❌ Sync verification failed:', err);
  process.exit(1);
});
