const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
  });
  logger.info('Connected to MongoDB Atlas');

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected.');
  });

  // Verify and create database indexes safely without blocking boot
  try {
    const User = require('../models/User');
    const Room = require('../models/Room');
    const Invite = require('../models/Invite');
    const Document = require('../models/Document');

    await Promise.all([
      User.createIndexes().catch((err) => logger.warn(`User index sync warning: ${err.message}`)),
      Room.createIndexes().catch((err) => logger.warn(`Room index sync warning: ${err.message}`)),
      Invite.createIndexes().catch((err) => logger.warn(`Invite index sync warning: ${err.message}`)),
      Document.createIndexes().catch((err) => logger.warn(`Document index sync warning: ${err.message}`)),
    ]);
    logger.info('MongoDB database indexes verified successfully');
  } catch (err) {
    logger.warn('Error verifying database indexes', err);
  }

  return mongoose.connection;
}

module.exports = { connectDB };