const express = require('express');
const { requireAuth } = require('../middleware/auth');
const requireRoomRole = require('../middleware/requireroomrole');
const { createRoom, getRoom, deleteRoom, listRooms, issueWsTicket } = require('../controllers/rooms.controller');
const { createInvite } = require('../controllers/invites.controller');
const Room = require('../models/Room');

const router = express.Router();

router.post('/', requireAuth, createRoom);
router.get('/', requireAuth, listRooms);
router.get('/:id', requireAuth, getRoom);

router.post('/:id/invites', requireAuth, requireRoomRole(['owner', 'editor']), createInvite);

// Any member (owner, editor, viewer) can request a ticket to join the live session
router.post('/:id/tickets', requireAuth, requireRoomRole(Room.ROLES), issueWsTicket);
// Only the owner can delete the room
router.delete('/:id', requireAuth, requireRoomRole(['owner']), deleteRoom);

module.exports = router;