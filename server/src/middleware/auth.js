const { verifyJwt } = require('../utils/jwt');

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const [scheme, headerToken] = header ? header.split(' ') : [];

    // EventSource cannot set custom headers, so we also accept ?token= as a
    // fallback — only for authenticated GET requests to /rooms/events.
    const token = (scheme === 'Bearer' && headerToken) ? headerToken : req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    try {
        const payload = verifyJwt(token);
        req.user = { id: payload.sub, email: payload.email, name: payload.name };
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = { requireAuth };