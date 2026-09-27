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
  if (globalListenerAttached) return;
  globalListenerAttached = true;
 
  // messageBuffer (not message) preserves the payload as raw bytes — Yjs
  // updates are binary and would be corrupted by ioredis's default
  // string decoding.
  subscriber.on('messageBuffer', (channelBuf, messageBuf) => {
    const channel = channelBuf.toString();
 
    if (channel === PERMISSION_CHANNEL) {
      handlePermissionUpdate(messageBuf);
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
  if (!doc) return; // not active on this instance — refcounting means this shouldn't happen
  Y.applyUpdate(doc, new Uint8Array(messageBuf), docSync.REMOTE_ORIGIN);
}
 
function applyRemoteAwarenessUpdate(roomId, messageBuf) {
  const instance = awareness.getAwareness(roomId);
  if (!instance) return;
  awarenessProtocol.applyAwarenessUpdate(instance, new Uint8Array(messageBuf), docSync.REMOTE_ORIGIN);
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
  ensureGlobalListener();
  if (subscribedRooms.has(roomId)) return;
  subscribedRooms.add(roomId);
  await subscriber.subscribe(docChannel(roomId), awarenessChannel(roomId));
}
 
// Call once the last local client for a room disconnects.
async function maybeUnsubscribe(roomId) {
  if (!subscribedRooms.has(roomId)) return;
  subscribedRooms.delete(roomId);
  await subscriber.unsubscribe(docChannel(roomId), awarenessChannel(roomId));
}
 
// Global, room-independent — subscribed once at server startup.
async function subscribeToPermissionUpdates() {
  ensureGlobalListener();
  await subscriber.subscribe(PERMISSION_CHANNEL);
}
 
async function publishDocUpdate(roomId, update) {
  await publisher.publish(docChannel(roomId), Buffer.from(update));
}
 
async function publishAwarenessUpdate(roomId, update) {
  await publisher.publish(awarenessChannel(roomId), Buffer.from(update));
}
 
async function publishPermissionUpdate(roomId, userId, role) {
  await publisher.publish(PERMISSION_CHANNEL, JSON.stringify({ roomId, userId, role }));
}
 
module.exports = {
  ensureSubscribed,
  maybeUnsubscribe,
  subscribeToPermissionUpdates,
  publishDocUpdate,
  publishAwarenessUpdate,
  publishPermissionUpdate,
};