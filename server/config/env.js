require('dotenv').config();

const REQUIRED_VARS = [
    'PORT',
    'MONGO_URI',
    'REDIS_URL',
    'JWT_SECRET',
    'WS_TICKET_TTL_SECONDS',
];

function loadEnv(){
    const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
    if(missing.length > 0){
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return {
        port: process.env.PORT,
        mongoUri: process.env.MONGO_URI,
        redisUrl: process.env.REDIS_URL,
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        wsTicketTtlSeconds: Number(process.env.WS_TICKET_TTL_SECONDS, 10),
        snapshotDebounceMs: Number(process.env.SNAPSHOT_DEBOUNCE_MS || 3000),
        snapshotMaxUpdatesBeforeFlush: Number(process.env.SNAPSHOT_MAX_UPDATES || 50),
    };
}

module.exports = loadEnv();