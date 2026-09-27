const Y = require('yjs');
const DocumentModel = require('../models/Document');
const env = require('../config/env');
const logger = require('../utils/logger');
const { clear } = require('node:console');

// roomId -> { timer, count }
const pending = new Map();

async function flush(roomId, doc){
    const state = pending.get(roomId);
    if(state && state.timer){
        clearTimeout(state.timer);
    }
    pending.delete(roomId);
    const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));
    try {
        await DocumentModel.findOneAndUpdate(
            { roomId },
            { $set: { snapshot }, $inc: { version: 1 } },
            { upsert: true },
        )
    } catch (error) {
        logger.error(`Failed to flush snapshot for room ${roomId}: ${error}`);
    }
}

// Call on every applied doc-update. Debounces to ~3s of inactivity, but
// force-flushes every N updates so a long unbroken burst of edits (a paste,
// a fast typist) doesn't go 3s-since-first-keystroke without ever settling.

function scheduleFlush(roomId, doc){
    let state = pending.get(roomId);
    if(!state){
        state = { timer: null, count: 0 };
        pending.set(roomId, state);
    }
    state.count += 1;
    if(state.timer) clearTimeout(state.timer);
    if(state.count >= env.snapshotMaxUpdatesBeforeFlush){
        flush(roomId, doc); 
        return;
    }
    state.timer = setTimeout(() => 
        flush(roomId, doc),
        env.snapshotDebounceMs)

    
}

function flushNow(roomId, doc){
    return flush(roomId, doc);
}

module.exports = { scheduleSnapshot, flushNow };