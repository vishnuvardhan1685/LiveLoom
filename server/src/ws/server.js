const { WebSocketServer } = require('ws');
const url = require('url');
const { handleConnection } = require('./connection');
const logger = require('../utils/logger');
const { http } = require('npmlog');

function attachWsServer(server){
    const wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => {
        const { pathname } = url.parse(req.url);
        if( pathname === '/ws' ){
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (ws, req) => {
        handleConnection(ws, req).catch((err) => {
            logger.error('Error handling WS connection', err);
            ws.close(1011, 'internal server error');
        });
    });

    return wss;
}

module.exports = { attachWsServer };