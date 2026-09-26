const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { createRoom, getRoom, deleteRoom } = require('../controllers/rooms.controller');
const { issueTicket } = require('../services/ticket.service');
const router = express.Router();

router.post('/', requireAuth, createRoom);
router.get('/:id', requireAuth, getRoom);

router.post('/:id/invites', requireAuth, requireRoomRole(['owner', 'editor']), createInvite);

// Any member (owner, editor, viewer) can request a ticket to join the live session
router.post('/:id/tickets', requireAuth, requireRoomRole(Room.ROLES), issueTicket);
// Only the owner can delete the room
router.delete('/:id', requireAuth, requireRoomRole(['owner']), deleteRoom);
module.exports = router;