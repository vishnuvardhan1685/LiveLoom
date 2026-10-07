require('dotenv').config();

const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'WS_TICKET_SECRET',
  'CLIENT_ORIGINS',
];

function loadEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  }

  const rawOrigins = process.env.CLIENT_ORIGINS || process.env.CORS_ORIGIN || '*';
  const clientOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

  const isOriginAllowed = (origin) => {
    if (!origin) return true;
    if (clientOrigins.includes('*')) return true;
    if (clientOrigins.includes(origin)) return true;

    // Wildcard matching for Vercel preview deployments (e.g. https://*.vercel.app)
    return clientOrigins.some((pattern) => {
      if (!pattern.includes('*')) return false;
      const regexPattern = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      return new RegExp(regexPattern).test(origin);
    });
  };

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 4000),
    mongoUri: process.env.MONGO_URI,
    redisUrl: (process.env.REDIS_URL && process.env.REDIS_URL !== 'none' && process.env.REDIS_URL !== 'false') ? process.env.REDIS_URL : null,
    jwtSecret: process.env.JWT_SECRET,
    wsTicketSecret: process.env.WS_TICKET_SECRET || process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    wsTicketTtlSeconds: Number(process.env.WS_TICKET_TTL_SECONDS || 60),
    logLevel: process.env.LOG_LEVEL || 'info',
    logFormat: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'text'),
    trustProxy: process.env.TRUST_PROXY !== undefined
      ? (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' ? true : process.env.TRUST_PROXY)
      : (process.env.NODE_ENV === 'production' ? true : false),
    snapshotDebounceMs: Number(process.env.SNAPSHOT_DEBOUNCE_MS || 3000),
    snapshotMaxUpdatesBeforeFlush: Number(process.env.SNAPSHOT_MAX_UPDATES || 50),
    clientOrigins,
    corsOrigins: clientOrigins.includes('*') ? '*' : clientOrigins,
    isOriginAllowed,
  };
}

module.exports = loadEnv();