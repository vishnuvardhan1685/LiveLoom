const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const env = require('./config/env');
const redis = require('./config/redis');
const authRoutes = require('./routes/auth.routes');
const roomsRoutes = require('./routes/rooms.routes');
const invitesRoutes = require('./routes/invites.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { createRateLimiter, sanitizeInputs } = require('./middleware/security');

const app = express();

// Trust proxy setting for TLS-terminating load balancers / Nginx
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy === 'true' || env.trustProxy === '1' ? true : env.trustProxy);
}

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible CSP when frontend is hosted separately on Vercel
}));

// Cap body payload size to 5MB
app.use(express.json({ limit: '5mb' }));

// CORS preflight and headers matching CLIENT_ORIGINS (including Vercel preview wildcards)
app.use(
  cors({
    origin: (origin, callback) => {
      if (env.isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Sanitize incoming JSON payload objects against NoSQL injection
app.use(sanitizeInputs);

// ── Health & Readiness Endpoints ──────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/readyz', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisConfigured = !!env.redisUrl;
  const redisReady = !redisConfigured || (redis.publisher?.status === 'ready' && redis.subscriber?.status === 'ready');

  if (mongoReady && redisReady) {
    return res.status(200).json({
      status: 'ready',
      mongo: 'connected',
      redis: redisConfigured ? 'connected' : 'disabled (single-instance)',
    });
  }

  return res.status(503).json({
    status: 'not_ready',
    mongo: mongoReady ? 'connected' : 'disconnected',
    redis: redisConfigured ? (redisReady ? 'connected' : 'disconnected') : 'disabled',
  });
});

// Global IP Rate Limiter
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 10000);
app.use(createRateLimiter({ windowMs: 60_000, max: rateLimitMax, message: 'Rate limit exceeded' }));

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: Number(process.env.AUTH_RATE_LIMIT_MAX || 1000), message: 'Too many authentication attempts' });
const ticketLimiter = createRateLimiter({ windowMs: 60 * 1000, max: Number(process.env.TICKET_RATE_LIMIT_MAX || 2000), message: 'Too many ticket requests' });

app.use('/auth', authLimiter, authRoutes);
app.use('/rooms/:id/ws-ticket', ticketLimiter);
app.use('/rooms', roomsRoutes);
app.use('/invites', invitesRoutes);

// Dev-only endpoint for GC memory measurement
app.get(['/debug/gc-memory', '/api/debug/gc-memory'], (req, res) => {
  if (global.gc) global.gc();
  res.json({
    heapUsed: process.memoryUsage().heapUsed,
    rss: process.memoryUsage().rss,
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;