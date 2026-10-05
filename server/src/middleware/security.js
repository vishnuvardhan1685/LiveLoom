const httpError = require('../utils/httpError');

// In-memory sliding window rate-limiter map
const requestsMap = new Map();

/**
 * Rate Limiting Middleware
 * Limits max requests per IP within a time window.
 */
function createRateLimiter({ windowMs = 60_000, max = 30, message = 'Too many requests, please try again later.' }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!requestsMap.has(ip)) {
      requestsMap.set(ip, []);
    }

    const timestamps = requestsMap.get(ip).filter((ts) => now - ts < windowMs);
    timestamps.push(now);
    requestsMap.set(ip, timestamps);

    if (timestamps.length > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/**
 * Input Type Sanitizer Middleware
 * Prevents NoSQL object injection attacks by converting req.body inputs to clean primitive types.
 */
function sanitizeInputs(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'object' && req.body[key] !== null && !Array.isArray(req.body[key])) {
        delete req.body[key]; // Strip injected operator objects like { "$ne": null }
      }
    }
  }
  next();
}

module.exports = {
  createRateLimiter,
  sanitizeInputs,
};
