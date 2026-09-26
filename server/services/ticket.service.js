const crypto = require('crypto');
const { commandClient } = require('../config/redis');
const env = require('../config/env');

const TICKET_PREFIX = 'wsticket:';

// Ticket payload is deliberately minimal — just enough to identify who's
// connecting and to which room. Role is looked up fresh from room state at
// handshake time (and again on every doc-update), never baked into the
// ticket, so a role change mid-session doesn't require a new ticket.
async function issueTicket({ userId, roomId }) {
  const ticket = crypto.randomBytes(24).toString('hex');
  const key = `${TICKET_PREFIX}${ticket}`;
  const value = JSON.stringify({ userId, roomId });

  await commandClient.set(key, value, 'EX', env.wsTicketTtlSeconds);
  return ticket;
}

// GETDEL is an atomic get-and-delete (Redis 6.2+): two concurrent handshakes
// racing on the same ticket can't both get a non-null result.
async function consumeTicket(ticket) {
  const key = `${TICKET_PREFIX}${ticket}`;
  const raw = await commandClient.getdel(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

module.exports = { issueTicket, consumeTicket };