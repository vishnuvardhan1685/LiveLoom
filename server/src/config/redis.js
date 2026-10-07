const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let commandClient = null;
let publisher = null;
let subscriber = null;

if (env.redisUrl) {
  function makeClient(name) {
    const client = new Redis(env.redisUrl);
    client.on('error', (err) => {
      logger.error(`Redis client (${name}) error: ${err}`);
    });
    client.on('connect', () => {
      logger.info(`Connected to Redis (${name})`);
    });
    return client;
  }

  commandClient = makeClient('command');
  publisher = makeClient('publisher');
  subscriber = makeClient('subscriber');
} else {
  logger.info('REDIS_URL not set — running in single-instance mode');
}

async function closeRedis() {
  if (!env.redisUrl) return;
  const promises = [];
  if (commandClient) promises.push(commandClient.quit());
  if (publisher) promises.push(publisher.quit());
  if (subscriber) promises.push(subscriber.quit());
  await Promise.all(promises);
  logger.info('Redis clients closed');
}

module.exports = {
  commandClient,
  publisher,
  subscriber,
  closeRedis,
};