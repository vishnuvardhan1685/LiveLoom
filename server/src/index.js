const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const { attachWsServer } = require('./ws/server');
const redisBridge = require('./ws/redisBridge');
const { closeRedis } = require('./config/redis');
const docRegistry = require('./docStore/docRegistry');

async function start() {
  await connectDB();
  const server = http.createServer(app);
  const wss = attachWsServer(server);
  await redisBridge.subscribeToPermissionUpdates();

  server.listen(env.port, '0.0.0.0', () => {
    logger.info(`LiveLoom REST server listening on port ${env.port} bound to 0.0.0.0`);
  });

  let isShuttingDown = false;

  async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown sequence...`);

    // 1. Stop accepting new connections
    server.close(() => {
      logger.info('[SHUTDOWN] HTTP server stopped accepting new connections.');
    });

    // 2. Close active WebSocket connections with 1001 (Going Away)
    let wsCount = 0;
    if (wss && wss.clients) {
      wsCount = wss.clients.size;
      wss.clients.forEach((ws) => {
        try {
          ws.close(1001, 'Server shutting down');
        } catch (_) {}
      });
    }
    logger.info(`[SHUTDOWN] Closed ${wsCount} active WebSocket client connections with code 1001.`);

    // 3. Flush pending Yjs persistence to Mongo
    try {
      await docRegistry.flushAll();
    } catch (err) {
      logger.error('[SHUTDOWN] Error flushing Yjs snapshots', err);
    }

    // 4. Close Redis
    try {
      await closeRedis();
    } catch (err) {
      logger.error('[SHUTDOWN] Error closing Redis', err);
    }

    // 5. Close Mongo
    try {
      await mongoose.connection.close();
      logger.info('[SHUTDOWN] MongoDB connection closed.');
    } catch (err) {
      logger.error('[SHUTDOWN] Error closing MongoDB connection', err);
    }

    logger.info('[SHUTDOWN] Graceful shutdown finished. Exiting process.');
    process.exit(0);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});