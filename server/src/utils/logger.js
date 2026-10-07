const env = require('../config/env');

const LOG_LEVEL = env.logLevel || 'info';
const LOG_FORMAT = env.logFormat || 'text';

function formatLog(level, msg, meta) {
  const timestamp = new Date().toISOString();
  if (LOG_FORMAT === 'json') {
    return JSON.stringify({ timestamp, level, message: msg, ...(meta ? { meta } : {}) });
  }
  return `[${level.toUpperCase()}] [${timestamp}] ${msg}${meta ? ' ' + (typeof meta === 'object' ? JSON.stringify(meta) : meta) : ''}`;
}

module.exports = {
  info: (msg, meta) => {
    if (LOG_LEVEL === 'warn' || LOG_LEVEL === 'error' || LOG_LEVEL === 'none') return;
    console.log(formatLog('info', msg, meta));
  },
  warn: (msg, meta) => {
    if (LOG_LEVEL === 'error' || LOG_LEVEL === 'none') return;
    console.warn(formatLog('warn', msg, meta));
  },
  error: (msg, meta) => {
    if (LOG_LEVEL === 'none') return;
    console.error(formatLog('error', msg, meta));
  },
};