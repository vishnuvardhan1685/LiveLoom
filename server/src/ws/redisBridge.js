const Y = require('yjs');
const awarenessProtocol = require('y-protocols/awareness');
const { publisher, subscriber } = require('../config/redis');
const docRegistry = require('../docStore/docRegistry');
const awareness = require('./awareness');
const docSync = require('./docSync');
const roomState = require('../services/roomstate.service');
const logger = require('../utils/logger');

const PERMISSION_CHANNEL = 'permission:update';

const docChannel = (roomId) => `room:${roomId}:doc`;
const awarenessChannel = (roomId) => `room:${roomId}:awareness`;

// Rooms this instance is currently subscribed to — subscribe once per room
// no matter how many local sockets join it (spec §4 step 5).
const subscribedRooms = new Set();
let globalListenerAttached = false;

function ensureGlobalListener() {
  if (!subscriber || globalListenerAttached) return;
  globalListenerAttached = true;

  subscriber.on('messageBuffer', (channelBuf, messageBuf) => {
    const channel = channelBuf.toString();

    if (channel === PERMISSION_CHANNEL) {
      handlePermissionUpdate(messageBuf);
      return;
    }

    if (channel === ROOM_DELETED_CHANNEL) {
      handleRoomDeleted(messageBuf);
      return;
    }

    if (channel.startsWith(USER_EVENT_PREFIX)) {
      handleUserEvent(messageBuf);
      return;
    }

    const docMatch = channel.match(/^room:(.+):doc$/);
    if (docMatch) {
      applyRemoteDocUpdate(docMatch[1], messageBuf);
      return;
    }

    const awarenessMatch = channel.match(/^room:(.+):awareness$/);
    if (awarenessMatch) {
      applyRemoteAwarenessUpdate(awarenessMatch[1], messageBuf);
    }
  });
}

function applyRemoteDocUpdate(roomId, messageBuf) {
  const doc = docRegistry.getDoc(roomId);
  if (!doc) return;
  try {
    const uint8 = new Uint8Array(messageBuf);
    if (uint8.byteLength > 0) {
      Y.applyUpdate(doc, uint8, docSync.REMOTE_ORIGIN);
    }
  } catch (err) {
    logger.error(`Failed to apply remote doc update for room ${roomId}`, err);
  }
}

function applyRemoteAwarenessUpdate(roomId, messageBuf) {
  const instance = awareness.getAwareness(roomId);
  if (!instance) return;
  try {
    const uint8 = new Uint8Array(messageBuf);
    if (uint8.byteLength > 0) {
      awarenessProtocol.applyAwarenessUpdate(instance, uint8, docSync.REMOTE_ORIGIN);
    }
  } catch (err) {
    logger.error(`Failed to apply remote awareness update for room ${roomId}`, err);
  }
}

function handlePermissionUpdate(messageBuf) {
  try {
    const { roomId, userId, role } = JSON.parse(messageBuf.toString());
    roomState.setRole(roomId, userId, role);
  } catch (err) {
    logger.error('Failed to parse permission:update message', err);
  }
}

async function ensureSubscribed(roomId) {
  if (!subscriber) return;
  ensureGlobalListener();
  if (subscribedRooms.has(roomId)) return;
  subscribedRooms.add(roomId);
  await subscriber.subscribe(docChannel(roomId), awarenessChannel(roomId));
}

async function maybeUnsubscribe(roomId) {
  if (!subscriber) return;
  if (!subscribedRooms.has(roomId)) return;
  subscribedRooms.delete(roomId);
  await subscriber.unsubscribe(docChannel(roomId), awarenessChannel(roomId));
}

async function subscribeToPermissionUpdates() {
  if (!subscriber) return;
  ensureGlobalListener();
  await subscriber.subscribe(PERMISSION_CHANNEL, ROOM_DELETED_CHANNEL);
}

async function publishDocUpdate(roomId, update) {
  if (!publisher) return;
  await publisher.publish(docChannel(roomId), Buffer.from(update));
}

async function publishAwarenessUpdate(roomId, update) {
  if (!publisher) return;
  await publisher.publish(awarenessChannel(roomId), Buffer.from(update));
}

const ROOM_DELETED_CHANNEL = 'room:deleted';
const USER_EVENT_PREFIX    = 'user-events:';

const sseClients = new Map();

function userEventChannel(userId) {
  return `${USER_EVENT_PREFIX}${userId}`;
}

function handleRoomDeleted(messageBuf) {
  try {
    const { roomId, roomName } = JSON.parse(messageBuf.toString());
    logger.info(`[ROOM DELETED] Closing local sockets for room=${roomId}`);
    const roomSockets = require('./roomSockets');
    roomSockets.closeRoom(roomId, 4403, 'room deleted');
    require('../docStore/docRegistry').scheduleEviction(roomId);
  } catch (err) {
    logger.error('Failed to handle room:deleted message', err);
  }
}

function handleUserEvent(messageBuf) {
  try {
    const { userId, event } = JSON.parse(messageBuf.toString());
    const clients = sseClients.get(userId);
    if (!clients || clients.size === 0) return;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) {
      try { res.write(data); } catch (_) {}
    }
  } catch (err) {
    logger.error('Failed to handle user event message', err);
  }
}

function addSseClient(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
  if (subscriber) {
    subscriber.subscribe(userEventChannel(userId)).catch((err) => {
      logger.error(`Failed to subscribe to user event channel for ${userId}`, err);
    });
  }
  return () => {
    const set = sseClients.get(userId);
    if (set) { set.delete(res); if (set.size === 0) sseClients.delete(userId); }
  };
}

async function publishUserEvent(userId, event) {
  if (!publisher) return;
  await publisher.publish(userEventChannel(userId), JSON.stringify({ userId, event }));
}

async function publishRoomDeleted(roomId, roomName) {
  if (!publisher) return;
  await publisher.publish(ROOM_DELETED_CHANNEL, JSON.stringify({ roomId, roomName }));
}

async function publishPermissionUpdate(roomId, userId, role) {
  if (!publisher) return;
  await publisher.publish(PERMISSION_CHANNEL, JSON.stringify({ roomId, userId, role }));
}

module.exports = {
  ensureSubscribed,
  maybeUnsubscribe,
  subscribeToPermissionUpdates,
  publishDocUpdate,
  publishAwarenessUpdate,
  publishPermissionUpdate,
  publishRoomDeleted,
  publishUserEvent,
  addSseClient,
};