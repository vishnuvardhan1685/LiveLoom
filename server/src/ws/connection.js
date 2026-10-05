const decoding = require('lib0/decoding');
const Room = require('../models/Room');
const { consumeTicket } = require('../services/ticket.service');
const roomState = require('../services/roomstate.service');
const docRegistry = require('../docStore/docRegistry');
const roomSockets = require('./roomSockets');
const redisBridge = require('./redisBridge');
const snapshotService = require('../services/snapshot.service');
const docSync = require('./docSync');
const awarenessMod = require('./awareness');
const logger = require('../utils/logger');

function close(ws, code, reason) {
  try {
    ws.close(code, reason);
  } catch (err) {
    logger.error('Error closing ws', err);
  }
}

// Dispatch one decoded message frame. Called both from the queue-flush and
// from the live ws.on('message') handler once setup is complete.
function dispatch(ws, data, { roomId, userId, doc, awareness }) {
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const decoder = decoding.createDecoder(bytes);
    const topLevelType = decoding.readVarUint(decoder);
    const ts = new Date().toISOString();

    if (topLevelType === docSync.messageSync) {
      logger.info(`[MSG ${ts}] room=${roomId} user=${userId} type=sync`);
      docSync.handleSyncMessage(ws, decoder, { roomId, userId, doc });
    } else if (topLevelType === awarenessMod.messageAwareness) {
      logger.info(`[MSG ${ts}] room=${roomId} user=${userId} type=awareness`);
      awarenessMod.handleAwarenessMessage(ws, decoder, { roomId, awareness });
    } else {
      logger.warn(`[MSG ${ts}] room=${roomId} user=${userId} unknown type=${topLevelType}`);
    }
  } catch (err) {
    logger.error('Error dispatching WS message', err);
  }
}

async function handleConnection(ws, req) {
  const parsedUrl = new URL(req.url, 'http://localhost');

  // y-websocket appends /<roomId> as a path segment AND sends roomId as a
  // query param. Log all three values to confirm they are the same MongoDB
  // ObjectId string ("Room_26" is the room *name* — the ObjectId is different).
  const pathSegment = parsedUrl.pathname.replace(/^\/ws\/?/, '') || '(empty)';
  const roomIdParam = parsedUrl.searchParams.get('roomId');
  const ticket      = parsedUrl.searchParams.get('ticket');

  // consumeTicket is now synchronous — pure HMAC verify, no Redis round-trip.
  const payload = ticket ? consumeTicket(ticket) : null;

  logger.info(
    `[WS OPEN ${new Date().toISOString()}] ` +
    `path-segment="${pathSegment}" ` +
    `query-roomId="${roomIdParam}" ` +
    `token-roomId="${payload?.roomId ?? 'INVALID'}" ` +
    `userId="${payload?.userId ?? 'INVALID'}" ` +
    `ticketValid=${!!payload}`
  );

  const roomId = roomIdParam; // canonical value used by all server logic

  if (!payload || payload.roomId !== roomId) {
    close(ws, 4001, 'invalid or expired ticket');
    return;
  }
  const { userId } = payload;

  // ── CRITICAL: attach message handler BEFORE any await ───────────────────
  // y-websocket sends sync step 1 immediately after the WS handshake. The
  // async setup below (Mongo + Redis) can take 50–200 ms. Without this queue
  // the client's step-1 frame arrives during await and is silently dropped,
  // which means the server never sends step 2, and provider.synced never
  // becomes true — causing "CRDT SYNCING" forever.
  const messageQueue = [];
  let setupDone = false;
  let setupContext = null; // { roomId, userId, doc, awareness } — set after setup

  ws.on('message', (data) => {
    if (!setupDone) {
      // Buffer frames that arrive before setup finishes.
      messageQueue.push(data);
    } else {
      dispatch(ws, data, setupContext);
    }
  });

  // ── Async setup ─────────────────────────────────────────────────────────

  const roleMap = await roomState.loadRoleMap(roomId);
  const role = roleMap ? roomState.getRole(roomId, userId) : null;
  if (!role) {
    close(ws, 4001, 'not a member of this room');
    return;
  }

  // Capacity check: INCR first, then compare against maxUsers to avoid TOCTOU.
  const room = await Room.findById(roomId).select('maxUsers').lean();
  if (!room) {
    close(ws, 4001, 'room not found');
    return;
  }
  const countAfterIncr = await roomState.incrementActiveCount(roomId);
  if (countAfterIncr > room.maxUsers) {
    await roomState.decrementActiveCount(roomId);
    close(ws, 4002, 'room full');
    return;
  }

  // Hydrate or reuse the in-memory Y.Doc for this room.
  const doc = await docRegistry.getOrCreateDoc(roomId);
  const awareness = awarenessMod.getOrCreateAwareness(roomId, doc);

  docSync.ensureUpdateBroadcast(roomId, doc, {
    publishDocUpdate: redisBridge.publishDocUpdate,
    scheduleSnapshot: snapshotService.scheduleSnapshot,
  });
  awarenessMod.ensureAwarenessBroadcast(roomId, awareness, {
    publishAwarenessUpdate: redisBridge.publishAwarenessUpdate,
  });

  // Subscribe to this room's Redis channels (once per instance per room).
  await redisBridge.ensureSubscribed(roomId);

  roomSockets.addSocket(roomId, ws);

  // Send sync step 1 so the client can diff and send step 2 back to us.
  const ts1 = new Date().toISOString();
  logger.info(`[SYNC-STEP1 ${ts1}] room=${roomId} user=${userId} → sending state vector`);
  docSync.sendSyncStep1(ws, doc);

  // Send current awareness states so the newcomer sees existing cursors.
  awarenessMod.sendCurrentStates(ws, awareness);

  // ── Flush queued messages ───────────────────────────────────────────────
  // Any frames that arrived during setup are processed in-order now, before
  // we flip setupDone so no interleaving can occur.
  setupContext = { roomId, userId, doc, awareness };
  setupDone = true;

  if (messageQueue.length > 0) {
    logger.info(`[QUEUE FLUSH] room=${roomId} user=${userId} flushing ${messageQueue.length} queued message(s)`);
    for (const data of messageQueue) {
      dispatch(ws, data, setupContext);
    }
    messageQueue.length = 0;
  }

  ws.on('close', () => {
    awarenessMod.clearConnAwareness(roomId, ws);
    const remainingLocal = roomSockets.removeSocket(roomId, ws);

    roomState.decrementActiveCount(roomId).catch((err) => {
      logger.error(`Failed to decrement active count for room ${roomId}`, err);
    });

    if (remainingLocal === 0) {
      redisBridge.maybeUnsubscribe(roomId).catch((err) => {
        logger.error(`Failed to unsubscribe from room ${roomId}`, err);
      });
      docRegistry.scheduleEviction(roomId);
    }

    logger.info(`[WS CLOSE ${new Date().toISOString()}] room=${roomId} user=${userId} remainingLocal=${remainingLocal}`);
  });
}

module.exports = { handleConnection };