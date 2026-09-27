require('dotenv').config();

const REQUIRED_VARS = [
  'PORT',
  'MONGO_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'WS_TICKET_TTL_SECONDS',
];

function loadEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    port: Number(process.env.PORT),
    mongoUri: process.env.MONGO_URI,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    wsTicketTtlSeconds: Number(process.env.WS_TICKET_TTL_SECONDS),
    // Debounced snapshot tuning (spec §6) — tweak here, not inline in the service.
    snapshotDebounceMs: Number(process.env.SNAPSHOT_DEBOUNCE_MS || 3000),
    snapshotMaxUpdatesBeforeFlush: Number(process.env.SNAPSHOT_MAX_UPDATES || 50),
    // Comma-separated list of allowed frontend origins, e.g.
    // "http://localhost:5173,https://liveloom.example.com". Defaults to "*"
    // for local dev — lock this down before deploying anywhere real.
    corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map((o) => o.trim()),
  };
}

module.exports = loadEnv();