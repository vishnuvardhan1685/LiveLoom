const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const roomsRoutes = require('./routes/rooms.routes');
const invitesRoutes = require('./routes/invites.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// CORS has to be registered before routes (and before express.json()) so
// preflight OPTIONS requests are answered without ever reaching them.
app.use(
  cors({
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);
app.use('/invites', invitesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;