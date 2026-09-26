const http = require('http');
const app = require('./app');
const env = require('./utils/env');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

async function start(){
    await connectDB();
    const server = http.createServer(app);
    server.listen(env.port, () => {
        logger.info(`Liveloom REST server listening on port ${env.port}`);
    })
}

start().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
});