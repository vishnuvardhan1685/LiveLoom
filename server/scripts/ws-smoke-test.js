/**
 * Smoke test for the whole backend: signup -> room -> invite -> ws-ticket ->
 * WS connect -> Yjs sync -> permission enforcement.
 *
 * Run with the server already up (npm run dev / docker-compose up):
 *   node scripts/ws-smoke-test.js
 *
 * Override the target with env vars if needed:
 *   BASE_URL=http://localhost:4000 WS_URL=ws://localhost:4000/ws node scripts/ws-smoke-test.js
 */

const WebSocket = require('ws');
const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const syncProtocol = require('y-protocols/sync');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const WS_URL = process.env.WS_URL || 'ws://localhost:4000/ws';
const messageSync = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function signupOrLogin(email, password, name) {
  const signup = await api('POST', '/auth/signup', null, { email, password, name });
  if (signup.status === 201) return signup.data;

  const login = await api('POST', '/auth/login', null, { email, password });
  if (login.status !== 200) {
    throw new Error(`Could not signup or login ${email}: ${JSON.stringify(login.data)}`);
  }
  return login.data;
}

function connectClient(label, ticket, roomId, doc) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?ticket=${ticket}&roomId=${roomId}`);
    let settled = false;

    ws.on('open', () => console.log(`  [${label}] WS open`));

    ws.on('message', (data) => {
      if (typeof data === 'string') {
        console.log(`  [${label}] server said:`, data);
        return;
      }
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const topType = decoding.readVarUint(decoder);
      if (topType !== messageSync) return; // ignoring awareness frames for this test

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`  [${label}] WS closed: ${code} ${reason}`);
      if (!settled) reject(new Error(`${label} closed before ready (code ${code})`));
    });
    ws.on('error', (err) => {
      if (!settled) reject(err);
    });

    // Only re-broadcast updates that originated locally (not ones we just
    // applied *from* the network — those already have origin === ws).
    doc.on('update', (update, origin) => {
      if (origin === ws) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      ws.send(encoding.toUint8Array(encoder));
    });

    ws.once('open', () => {
      settled = true;
      resolve(ws);
    });
  });
}

async function main() {
  console.log('1. Signing up / logging in two users...');
  const owner = await signupOrLogin('owner@smoketest.dev', 'password123', 'Owner');
  const viewer = await signupOrLogin('viewer@smoketest.dev', 'password123', 'Viewer');

  console.log('2. Creating room as owner...');
  const room = (await api('POST', '/rooms', owner.token, { name: 'Smoke Test Room' })).data;
  console.log(`   room id: ${room.id}`);

  console.log('3. Creating a single-use viewer invite...');
  const invite = (
    await api('POST', `/rooms/${room.id}/invites`, owner.token, {
      role: 'viewer',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      maxUses: 1,
    })
  ).data;

  console.log('4. Redeeming invite as the viewer...');
  const redeemed = (await api('GET', `/invites/${invite.token}`, viewer.token)).data;
  console.log(`   viewer role: ${redeemed.role}`);

  console.log('5. Re-using the same (now exhausted) invite...');
  const reused = await api('GET', `/invites/${invite.token}`, viewer.token);
  console.log(`   expected 410, got: ${reused.status}`);

  console.log('6. Requesting WS tickets for both users...');
  const ownerTicket = (await api('POST', `/rooms/${room.id}/ws-ticket`, owner.token)).data.ticket;
  const viewerTicket = (await api('POST', `/rooms/${room.id}/ws-ticket`, viewer.token)).data.ticket;

  console.log('7. Connecting both clients over WS...');
  const ownerDoc = new Y.Doc();
  const viewerDoc = new Y.Doc();
  const ownerWs = await connectClient('owner', ownerTicket, room.id, ownerDoc);
  const viewerWs = await connectClient('viewer', viewerTicket, room.id, viewerDoc);

  await sleep(500); // let initial sync-step-1/2 settle

  console.log('8. Owner types something...');
  ownerDoc.getText('shared').insert(0, 'Hello from the owner\n');
  await sleep(500);

  const viewerSees = viewerDoc.getText('shared').toString();
  console.log(`   viewer's copy now reads: ${JSON.stringify(viewerSees)}`);
  console.log(`   PASS? ${viewerSees.includes('Hello from the owner') ? 'yes' : 'NO - sync is broken'}`);

  console.log('9. Viewer attempts to type (should be rejected)...');
  viewerDoc.getText('shared').insert(0, 'I should not be allowed to type this\n');
  await sleep(500);

  const ownerSees = ownerDoc.getText('shared').toString();
  const leaked = ownerSees.includes('I should not be allowed');
  console.log(`   PASS? ${!leaked ? 'yes - rejected as expected' : 'NO - viewer edit leaked through'}`);
  console.log('   NOTE: the viewer\'s own local doc still shows their attempted edit — Yjs');
  console.log('   applies changes locally before the network round-trip. The server correctly');
  console.log('   refused to apply/broadcast it, but nothing here stops the *client UI* from');
  console.log('   letting a viewer type in the first place — Monaco needs to be set read-only');
  console.log('   for viewers based on their role, as a first line of defense.');

  ownerWs.close();
  viewerWs.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});