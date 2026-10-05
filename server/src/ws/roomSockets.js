const rooms = new Map();
// roomId -> Set<ws>
function addSocket(roomId, ws) {
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);
}

// Returns the remaining local socket count for the room, so callers can tell
// when the last local client for a room has gone (spec §4 disconnect handling).

function removeSocket(roomId, ws) {
    const set = rooms.get(roomId);
    if (!set) return 0;
    set.delete(ws);
    if (set.size === 0) {
        rooms.delete(roomId);
        return 0;
    }
    return set.size;
}

function localCount(roomId) {
    const set = rooms.get(roomId);
    return set ? set.size : 0;
}

// Send a payload to every local socket in the room. Pass `excludeWs` to skip
// the connection that triggered the update (it already has this state).
function broadcastLocal(roomId, payload, excludeWs) {
    const set = rooms.get(roomId);
    if (!set) return;
    for (const ws of set) {
        if (ws !== excludeWs && ws.readyState === ws.OPEN) {
            ws.send(payload);
        }
    }
}

module.exports = { addSocket, removeSocket, localCount, broadcastLocal };