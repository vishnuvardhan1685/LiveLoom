const { WebSocketServer } = require('ws');
const url = require('url');
const { handleConnection } = require('./connection');
const logger = require('../utils/logger');

function attachWsServer(server){
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
        const { pathname } = url.parse(req.url);
        // y-websocket's WebsocketProvider always appends '/roomname' to the
        // serverUrl, so real connections land on '/ws/<roomId>', not '/ws'.
        if( !pathname || !pathname.startsWith('/ws') ){
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