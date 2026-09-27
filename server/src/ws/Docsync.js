const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const syncProtocol = require('y-protocols/sync');
const roomState = require('../services/roomstate.service');
const roomSockets = require('./roomSockets');
const logger = require('../utils/logger');

const messageSync = 0; // top-level envelope byte shared with awareness (messageAwareness = 1)

// Marker used as the Yjs transaction origin when an update is applied because
// it arrived from another instance via Redis, rather than from a local
// socket. Anything reacting to doc.on('update', ...) uses this to avoid
// re-publishing the update back to Redis (which would loop forever) and to
// know it should broadcast to *all* local sockets, not "all except sender".
const REMOTE_ORIGIN = Symbol('redis-remote-doc-update');

// Doc instances that already have a broadcast/publish listener attached.
// Keyed by the Y.Doc object itself so a fresh doc (post-eviction) gets a
// fresh listener instead of silently having none.
const docsWithListener = new WeakSet();

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(payload);
}

function isEditAllowed(roomId, userId) {
  const role = roomState.getRole(roomId, userId);
  return role === 'owner' || role === 'editor';
}

function sendPermissionDenied(ws) {
  send(ws, JSON.stringify({ type: 'error', code: 'permission-denied', message: 'viewers cannot edit' }));
}

// Sent once, right after handshake, so the client's y-websocket provider can
// diff against the server's state and converge immediately (spec §4 step 6).
function sendSyncStep1(ws, doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(ws, encoding.toUint8Array(encoder));
}

// Attaches the doc's update->broadcast/publish/snapshot pipeline exactly
// once per Y.Doc instance, regardless of how many connections join the room.
function ensureUpdateBroadcast(roomId, doc, { publishDocUpdate, scheduleSnapshot }) {
  if (docsWithListener.has(doc)) return;
  docsWithListener.add(doc);

  doc.on('update', (update, origin) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const payload = encoding.toUint8Array(encoder);

    // origin is the ws that sent it (exclude just that one), or REMOTE_ORIGIN
    // (exclude no one — none of the local sockets have this update yet).
    const excludeWs = origin === REMOTE_ORIGIN ? null : origin;
    roomSockets.broadcastLocal(roomId, payload, excludeWs);

    if (origin !== REMOTE_ORIGIN) {
      publishDocUpdate(roomId, update);
    }

    scheduleSnapshot(roomId, doc);
  });
}

// Handles one incoming `messageSync`-tagged frame. Permission is checked
// before the mutating sub-messages (step2 / update) are applied — not after,
// since by the time doc.on('update') fires the mutation has already happened.
function handleSyncMessage(ws, decoder, { roomId, userId, doc }) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  const subType = decoding.readVarUint(decoder);

  switch (subType) {
    case syncProtocol.messageYjsSyncStep1:
      // Read-only from the doc's perspective — always allowed, even for viewers.
      syncProtocol.readSyncStep1(decoder, encoder, doc);
      break;

    case syncProtocol.messageYjsSyncStep2:
      if (!isEditAllowed(roomId, userId)) {
        sendPermissionDenied(ws);
        return;
      }
      syncProtocol.readSyncStep2(decoder, doc, ws);
      break;

    case syncProtocol.messageYjsUpdate:
      if (!isEditAllowed(roomId, userId)) {
        sendPermissionDenied(ws);
        return;
      }
      syncProtocol.readUpdate(decoder, doc, ws);
      break;

    default:
      logger.warn(`Unknown sync sub-message type ${subType}`);
      return;
  }

  if (encoding.length(encoder) > 1) {
    send(ws, encoding.toUint8Array(encoder));
  }
}

module.exports = {
  messageSync,
  REMOTE_ORIGIN,
  sendSyncStep1,
  ensureUpdateBroadcast,
  handleSyncMessage,
};