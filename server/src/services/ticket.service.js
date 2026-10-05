const crypto = require('crypto');
const env = require('../config/env');

// WS Ticket — short-lived, reusable HMAC-signed JWT-style token.
//
// Why not single-use Redis tokens?
//   y-websocket auto-reconnects with the same URL, and React StrictMode
//   double-invokes effects — both fire a second WS open with the same ticket.
//   A GETDEL token is consumed on the first handshake and the second gets
//   4001, triggering an unnecessary onNeedNewTicket loop.
//
// Security model:
//   The token is signed with HMAC-SHA256 (same JWT_SECRET). The server verifies
//   signature + expiry + roomId match. Role is still looked up live from the
//   role map so mid-session role changes take effect immediately.
//
// Token format: base64url(header).base64url(payload).base64url(signature)

const TICKET_TTL_SECONDS = 600; // 10 minutes — long enough for auto-reconnects

function b64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  const padded = str + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function issueTicket({ userId, roomId }) {
  const header  = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'WS-TICKET' })));
  const payload = b64urlEncode(Buffer.from(JSON.stringify({
    userId,
    roomId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  })));
  const sigInput = `${header}.${payload}`;
  const sig = b64urlEncode(
    crypto.createHmac('sha256', env.jwtSecret).update(sigInput).digest()
  );
  return `${sigInput}.${sig}`;
}

// Returns { userId, roomId } on success, null on any failure.
// Does NOT delete or mutate any state — safe for reconnects and double-mounts.
function consumeTicket(ticket) {
  try {
    const parts = ticket.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const sigInput = `${header}.${payload}`;
    const expected = b64urlEncode(
      crypto.createHmac('sha256', env.jwtSecret).update(sigInput).digest()
    );
    // Constant-time compare to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const claims = JSON.parse(b64urlDecode(payload).toString());
    if (!claims.exp || Date.now() / 1000 > claims.exp) return null;
    return { userId: claims.userId, roomId: claims.roomId };
  } catch (_) {
    return null;
  }
}

module.exports = { issueTicket, consumeTicket };