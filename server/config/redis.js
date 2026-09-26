const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

function makeClient(){
    const client = new Redis(env.redisUrl);
    client.on('error', (err) => {
        logger.error(`Redis client error: ${err}`);
    });
    client.on('connect', () => {
        logger.info('Connected to Redis');
    });
    return client;
}

const commandClient = makeClient('command');
const publisher = makeClient('publisher');
const subscriber = makeClient('subscriber');

async function closeRedis(){
    await Promise.all([
        commandClient.quit(),
        publisher.quit(),
        subsciber.quit(),
    ]);
    logger.info('Redis clients closed');
}

module.exports = {
    commandClient,
    publisher,
    subscriber,
    closeRedis,
};