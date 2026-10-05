const Y = require('yjs');
const DocumentModel = require('../models/Document');
const logger = require('../utils/logger');

// roomId -> { doc: Y.Doc, evictTimer: NodeJS.Timeout | null }
const registry = new Map();

// Keep a doc around briefly after the last local client disconnects, in case
// of a fast reconnect (spec §4 disconnect handling) — cheaper than reloading
// the snapshot from Mongo on every blip.
const EVICT_IDLE_MS = 30_000;

async function getOrCreateDoc(roomId) {
  const existing = registry.get(roomId);
  if (existing) {
    cancelEviction(roomId);
    return existing.doc;
  }

  const doc = new Y.Doc();
  try {
    const snapshotDoc = await DocumentModel.findOne({ roomId }).lean();
    if (snapshotDoc && snapshotDoc.snapshot) {
      const snapBuf = snapshotDoc.snapshot;
      const uint8 = new Uint8Array(
        Buffer.isBuffer(snapBuf)
          ? snapBuf
          : snapBuf.buffer
          ? snapBuf.buffer
          : snapBuf
      );
      if (uint8.byteLength > 0) {
        Y.applyUpdate(doc, uint8);
      }
    }
  } catch (err) {
    logger.error(`Corrupt Yjs snapshot in database for room ${roomId}. Resetting snapshot to unblock connections.`, err);
    // Unset corrupt snapshot in MongoDB so room automatically recovers
    DocumentModel.updateOne({ roomId }, { $unset: { snapshot: 1 } }).catch((dbErr) => {
      logger.error(`Failed to unset corrupt snapshot for room ${roomId}`, dbErr);
    });
  }

  registry.set(roomId, { doc, evictTimer: null });
  return doc;
}

function getDoc(roomId) {
  const entry = registry.get(roomId);
  return entry ? entry.doc : null;
}

function cancelEviction(roomId) {
  const entry = registry.get(roomId);
  if (entry && entry.evictTimer) {
    clearTimeout(entry.evictTimer);
    entry.evictTimer = null;
  }
}

// Call when the last local client for a room disconnects. Safe to rely on
// the snapshot debounce (§6, ~3s) having already flushed by the time this
// fires (30s later) under default config — if you shorten EVICT_IDLE_MS below
// the snapshot debounce window, add an explicit flush here first.
function scheduleEviction(roomId) {
  const entry = registry.get(roomId);
  if (!entry) return;

  cancelEviction(roomId);
  entry.evictTimer = setTimeout(() => {
    logger.info(`Evicting idle Y.Doc for room ${roomId}`);
    // Awareness is keyed by roomId, not by doc instance — it must be dropped
    // here too, or a reconnect after eviction would get an Awareness still
    // bound to this destroyed doc instead of a fresh one.
    // eslint-disable-next-line global-require
    require('../ws/awareness').removeRoomAwareness(roomId);
    entry.doc.destroy();
    registry.delete(roomId);
  }, EVICT_IDLE_MS);
}

module.exports = { getOrCreateDoc, getDoc, scheduleEviction, cancelEviction };