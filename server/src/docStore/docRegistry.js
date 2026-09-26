const Y = require('yjs');
const DocumentModel = require('../models/Document');
const logger = require('../utils/logger');
const { clear } = require('node:console');

// roomId -> { doc: Y.Doc, evictTimer: NodeJS.Timeout | null }
const registry = new Map(); 

// Keep a doc around briefly after the last local client disconnects, in case
// of a fast reconnect (spec §4 disconnect handling) — cheaper than reloading
// the snapshot from Mongo on every blip.

const EVICT_IDLE_MS = 30_000; // 30s

async function getOrCreateDoc(roomId) {
    const existing = registry.get(roomId);
    if(existing){
        cancelEviction(roomId);
        return existing.doc;
    }
    const doc = new Y.Doc();
    const snapshotDoc = await DocumentModel.findOne({ roomId }).lean();
    if (snapshotDoc && snapshotDoc.snapshot) {
        Y.applyUpdate(doc, snapshotDoc.snapshot);
    }
    registry.set(roomId, { doc, evictTimer: null });
    logger.info(`Doc for room ${roomId} created and loaded from snapshot`);
    return doc;
}

function getDoc(roomId) {
    const entry = registry.get(roomId);
    return entry ? entry.doc : null;
}

function cancelEviction(roomId) {
    const entry = registry.get(roomId);
    if(entry && entry.evictTimer){
        clearTimeout(entry.evictTimer);
        entry.evictTimer = null;
    }
}

// Call when the last local client disconnects, to schedule a delayed eviction of the doc.
function scheduleEviction(roomId) {
    const entry = registry.get(roomId);
    if(!entry) return;
    cancelEviction(roomId);
    entry.evictTimer = setTimeout(() => {
        entry.doc.destroy();
        registry.delete(roomId);
        logger.info(`Doc for room ${roomId} evicted from memory after idle timeout`);
    }, EVICT_IDLE_MS);
}

module.exports = { getOrCreateDoc, getDoc, scheduleEviction, cancelEviction };