const { commandClient } = require('../config/redis');
const Room = require('../models/Room');

// roomId -> Map<userId, role>
// This is what every doc-update permission check reads (spec §4) — it's
// per-instance, hydrated lazily, and kept in sync across instances via the
// `permission:update` Redis channel (wired up in ws/redisBridge.js, step 12).
const roleMaps = new Map();

async function loadRoleMap(roomId) {
  const existing = roleMaps.get(roomId);
  if (existing) return existing;

  const room = await Room.findById(roomId).lean();
  if (!room) return null;

  const map = new Map(room.members.map((m) => [m.userId.toString(), m.role]));
  roleMaps.set(roomId, map);
  return map;
}

function getRole(roomId, userId) {
  const map = roleMaps.get(roomId);
  if (!map || !userId) return null;
  return map.get(userId.toString()) || null;
}

// Called on room create/redeem/role-change so a live session reflects it
// immediately, without waiting for the next reconnect (spec §9 edge case:
// "role downgraded mid-session takes effect on the very next edit attempt").
function setRole(roomId, userId, role) {
  let map = roleMaps.get(roomId);
  if (!map) {
    map = new Map();
    roleMaps.set(roomId, map);
  }
  map.set(userId.toString(), role);
}

function removeRoleMap(roomId) {
  roleMaps.delete(roomId);
}

// --- Redis-backed active connection count (spec §4 handshake steps 2-3, §5) ---

function activeCountKey(roomId) {
  return `room:${roomId}:activeCount`;
}

async function getActiveCount(roomId) {
  const value = await commandClient.get(activeCountKey(roomId));
  return value ? Number(value) : 0;
}

async function incrementActiveCount(roomId) {
  const key = activeCountKey(roomId);
  const count = await commandClient.incr(key);
  // Set a generous TTL (24 hours) so a server crash doesn't leave a stale
  // count that permanently blocks the room. The count is decremented on clean
  // disconnects; the TTL is only a safety net for hard crashes.
  await commandClient.expire(key, 86400);
  return count;
}

async function decrementActiveCount(roomId) {
  const count = await commandClient.decr(activeCountKey(roomId));
  if (count <= 0) {
    // Guard against a stray negative key if DECR ever races ahead of INCR.
    await commandClient.del(activeCountKey(roomId));
    return 0;
  }
  return count;
}

module.exports = {
  loadRoleMap,
  getRole,
  setRole,
  removeRoleMap,
  getActiveCount,
  incrementActiveCount,
  decrementActiveCount,
};