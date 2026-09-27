const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const awarenessProtocol = require('y-protocols/awareness');
const roomSockets = require('./roomSockets');
const { REMOTE_ORIGIN } = require('./docSync');

const messageAwareness = 1; // shared top-level envelope byte (messageSync = 0)
 
// roomId -> Awareness
const awarenessByRoom = new Map();
// roomId -> Map<ws, Set<clientID>>  — which awareness client IDs a given
// socket introduced, so they can be cleared when that socket disconnects.
const connClientIds = new Map();

function send(ws, payload){
    if(ws.readyState === ws.OPEN) ws.send(payload);
}

function getOrCreateAwareness(roomId){
    let awareness = awarenessByRoom.get(roomId);
    if(awareness) return awareness;
    awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null); // no local state until a client joins
    awarenessByRoom.set(roomId, awareness);
    return awareness;
}

// Read-only accessor — used by the Redis bridge, which should never create an
// Awareness instance for a room this instance has no local connections for.
function getAwareness(roomId) {
  return awarenessByRoom.get(roomId) || null;
}

// Attaches the awareness->broadcast/publish pipeline once per room.
function ensureAwarenessBroadcast(roomId, awareness, { publishAwarenessUpdate }) {
  if (awareness._liveloomListenerAttached) return;
  awareness._liveloomListenerAttached = true;
 
  awareness.on('update', ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated, removed);
    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
 
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, update);
    const payload = encoding.toUint8Array(encoder);
 
    const excludeWs = origin === REMOTE_ORIGIN ? null : origin;
    roomSockets.broadcastLocal(roomId, payload, excludeWs);
 
    if (origin !== REMOTE_ORIGIN) {
      publishAwarenessUpdate(roomId, update);
    }
  });
}
 
// Sends every currently-known awareness state to a newly-joined client, so
// they see existing cursors immediately rather than waiting for someone
// else's next move.
function sendCurrentStates(ws, awareness) {
  const clientIds = Array.from(awareness.getStates().keys());
  if (clientIds.length === 0) return;
 
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds));
  send(ws, encoding.toUint8Array(encoder));
}
 
function handleAwarenessMessage(ws, decoder, { roomId, awareness }) {
  const update = decoding.readVarUint8Array(decoder);
  awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
 
  if (!connClientIds.has(roomId)) connClientIds.set(roomId, new Map());
  const roomConns = connClientIds.get(roomId);
  if (!roomConns.has(ws)) roomConns.set(ws, new Set());
 
  // applyAwarenessUpdate doesn't tell us which clientIDs were newly
  // introduced by this specific update, so decode it again cheaply to find
  // out (it's the same bytes we just applied).
  const decoderForIds = decoding.createDecoder(update);
  const numClients = decoding.readVarUint(decoderForIds);
  for (let i = 0; i < numClients; i += 1) {
    const clientId = decoding.readVarUint(decoderForIds);
    decoding.readVarUint(decoderForIds); // clock — not needed here
    decoding.readVarString(decoderForIds); // state JSON — not needed here
    roomConns.get(ws).add(clientId);
  }
}
 
// Called on socket close — removes any awareness state this connection owned
// so their cursor/selection disappears for everyone else immediately.
function clearConnAwareness(roomId, ws) {
  const awareness = awarenessByRoom.get(roomId);
  const roomConns = connClientIds.get(roomId);
  if (!awareness || !roomConns) return;
 
  const clientIds = roomConns.get(ws);
  roomConns.delete(ws);
  if (clientIds && clientIds.size > 0) {
    awarenessProtocol.removeAwarenessStates(awareness, Array.from(clientIds), null);
  }
}
 
function removeRoomAwareness(roomId) {
  awarenessByRoom.delete(roomId);
  connClientIds.delete(roomId);
}
 
module.exports = {
  messageAwareness,
  getOrCreateAwareness,
  getAwareness,
  ensureAwarenessBroadcast,
  sendCurrentStates,
  handleAwarenessMessage,
  clearConnAwareness,
  removeRoomAwareness,
};
 