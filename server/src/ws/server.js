const { WebSocketServer } = require('ws');
const { handleConnection } = require('./connection');
const logger = require('../utils/logger');
const env = require('../config/env');

// Server-initiated ping/pong keepalive.
// Fires every 30s to prevent proxy/load-balancer idle-timeout cuts.
// Any socket that misses a pong is terminated, which triggers its 'close'
// event and cleanly decrements the Redis activeCount.
const PING_INTERVAL_MS = 30_000;

function attachWsServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 5.2 * 1024 * 1024, // 5.2 MB limit allows 5MB file syncs while rejecting >5.2MB frames with code 1009
  });

  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    if (origin && !env.isOriginAllowed(origin)) {
      logger.warn(`[WS UPGRADE REJECTED] Origin "${origin}" not in allowed CLIENT_ORIGINS`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    if (!pathname || !pathname.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    ws.on('error', (err) => {
      logger.warn(`WS connection error: ${err.message}`);
      try {
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
          ws.close(1009, 'message too big');
        }
      } catch (_) {}
    });

    // Keepalive flag — set true on connect and on every pong response.
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Run our custom handshake (ticket validation, capacity check, Yjs sync).
    handleConnection(ws, req).catch((err) => {
      logger.error('Error handling WS connection', err);
      try { ws.close(1011, 'internal server error'); } catch (_) { /* noop */ }
    });
  });

  // Ping all connected clients every PING_INTERVAL_MS.
  // Sockets that haven't responded to the previous ping are terminated.
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate(); // triggers 'close' event → activeCount decrement
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL_MS);

  wss.on('close', () => clearInterval(pingInterval));

  return wss;
}

module.exports = { attachWsServer };