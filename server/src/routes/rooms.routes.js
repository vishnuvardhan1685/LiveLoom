const express = require('express');
const { requireAuth } = require('../middleware/auth');
const requireRoomRole = require('../middleware/requireroomrole');
const { createRoom, getRoom, deleteRoom, listRooms, issueWsTicket, getMembers, patchMemberRole, removeMember } = require('../controllers/rooms.controller');
const { createInvite } = require('../controllers/invites.controller');
const { addSseClient } = require('../ws/redisBridge');
const Room = require('../models/Room');

const router = express.Router();

router.post('/', requireAuth, createRoom);
router.get('/', requireAuth, listRooms);
// SSE channel: GET /rooms/events — user-scoped real-time notifications
// (room-deleted, role-changed, member-added/removed)
// MUST be registered before GET /:id so Express does not match "events" as a room id.
router.get('/events', requireAuth, (req, res) => {
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25_000);

  const cleanup = addSseClient(req.user.id, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanup();
  });
});

router.get('/:id', requireAuth, getRoom);

router.post('/:id/invites', requireAuth, requireRoomRole(['owner', 'editor']), createInvite);

// Any member (owner, editor, viewer) can request a ticket to join the live session
router.post('/:id/tickets', requireAuth, requireRoomRole(Room.ROLES), issueWsTicket);
// Alias for spec §3 path (POST /rooms/:id/ws-ticket) — smoke test + external clients use this
router.post('/:id/ws-ticket', requireAuth, requireRoomRole(Room.ROLES), issueWsTicket);
// Only the owner can delete the room
router.delete('/:id', requireAuth, requireRoomRole(['owner']), deleteRoom);

// Member management
// GET  /rooms/:id/members           — any member can list
// PATCH /rooms/:id/members/:userId  — owner only, body: { role }
// DELETE /rooms/:id/members/:userId — owner only, remove a member
router.get('/:id/members', requireAuth, requireRoomRole(Room.ROLES), getMembers);
router.patch('/:id/members/:userId', requireAuth, requireRoomRole(['owner']), patchMemberRole);
router.delete('/:id/members/:userId', requireAuth, requireRoomRole(['owner']), removeMember);

module.exports = router;