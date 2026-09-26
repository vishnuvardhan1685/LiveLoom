const express = require('express');
const authRoutes = require('./routes/authRoutes');
const roomsRoutes = require('./routes/roomsRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const { errorHandler, notFound} = require('./middleware/errorHandler');

const app = express()

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/invites', inviteRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;