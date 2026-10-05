const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const roomsRoutes = require('./routes/rooms.routes');
const invitesRoutes = require('./routes/invites.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const { createRateLimiter, sanitizeInputs } = require('./middleware/security');

const app = express();

// Security: Cap body payload size to 5MB to prevent DoS memory overflow attacks
app.use(express.json({ limit: '5mb' }));

// CORS preflight and headers
app.use(
  cors({
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Sanitize incoming JSON payload objects against NoSQL injection
app.use(sanitizeInputs);

// Global IP Rate Limiter (60 requests per minute)
app.use(createRateLimiter({ windowMs: 60_000, max: 120, message: 'Rate limit exceeded' }));

app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);
app.use('/invites', invitesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;