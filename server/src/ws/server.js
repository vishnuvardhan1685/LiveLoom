const { WebSocketServer } = require('ws');
const { handleConnection } = require('./connection');
const logger = require('../utils/logger');

// Server-initiated ping/pong keepalive.
// Fires every 25s to prevent proxy/load-balancer idle-timeout cuts.
// Any socket that misses a pong is terminated, which triggers its 'close'
// event and cleanly decrements the Redis activeCount.
const PING_INTERVAL_MS = 25_000;

function attachWsServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    // y-websocket appends '/roomId' to serverUrl, so connections land on
    // '/ws/<roomId>', not just '/ws'.
    if (!pathname || !pathname.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
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