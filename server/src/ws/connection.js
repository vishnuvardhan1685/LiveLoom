const url = require('url');
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

async function handleConnection(ws, req) {
  const { query } = url.parse(req.url, true);
  const { ticket, roomId } = query;

  // Step 1: validate ticket (single-use — already invalidated by consumeTicket).
  const payload = ticket ? await consumeTicket(ticket) : null;
  if (!payload || payload.roomId !== roomId) {
    close(ws, 4001, 'invalid or expired ticket');
    return;
  }
  const { userId } = payload;

  const roleMap = await roomState.loadRoleMap(roomId);
  const role = roleMap ? roomState.getRole(roomId, userId) : null;
  if (!role) {
    close(ws, 4001, 'not a member of this room');
    return;
  }

  // Step 2-3: capacity check, then INCR.
  const room = await Room.findById(roomId).select('maxUsers').lean();
  if (!room) {
    close(ws, 4001, 'room not found');
    return;
  }
  const currentCount = await roomState.getActiveCount(roomId);
  if (currentCount >= room.maxUsers) {
    close(ws, 4002, 'room full');
    return;
  }
  await roomState.incrementActiveCount(roomId);

  // Step 4: hydrate or reuse the in-memory Y.Doc for this room.
  const doc = await docRegistry.getOrCreateDoc(roomId);
  const awareness = awarenessMod.getOrCreateAwareness(roomId, doc);

  docSync.ensureUpdateBroadcast(roomId, doc, {
    publishDocUpdate: redisBridge.publishDocUpdate,
    scheduleSnapshot: snapshotService.scheduleSnapshot,
  });
  awarenessMod.ensureAwarenessBroadcast(roomId, awareness, {
    publishAwarenessUpdate: redisBridge.publishAwarenessUpdate,
  });

  // Step 5: subscribe to this room's Redis channels if this instance hasn't already.
  await redisBridge.ensureSubscribed(roomId);

  roomSockets.addSocket(roomId, ws);

  // Step 6: ack + sync so the client converges immediately.
  docSync.sendSyncStep1(ws, doc);
  awarenessMod.sendCurrentStates(ws, awareness);

  ws.on('message', (data) => {
    try {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const decoder = decoding.createDecoder(bytes);
      const topLevelType = decoding.readVarUint(decoder);

      if (topLevelType === docSync.messageSync) {
        docSync.handleSyncMessage(ws, decoder, { roomId, userId, doc });
      } else if (topLevelType === awarenessMod.messageAwareness) {
        awarenessMod.handleAwarenessMessage(ws, decoder, { roomId, awareness });
      } else {
        logger.warn(`Unknown top-level WS message type ${topLevelType}`);
      }
    } catch (err) {
      logger.error('Error handling WS message', err);
    }
  });

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
  });
}

module.exports = { handleConnection };