const express = require('express');
const authRoutes = require('./routes/authRoutes');
const roomsRoutes = require('./routes/roomsRoutes');
const { errorHandler, notFound} = require('./middleware/errorHandler');
const { error } = require('node:console');

const app = express()

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;