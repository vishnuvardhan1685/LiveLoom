const { verifyJwt } = requrie('../utils/jwt');

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const [scheme, token] = header ? header.split(' ') : [];

    if(scheme !== 'Bearer' || !token){
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