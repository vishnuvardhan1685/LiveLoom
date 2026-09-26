const Room = require('../models/Room');
const httpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { issueTicket } = require('../services/ticket.service');
const env = require('../config/env');

const createRoom = asyncHandler(async (req, res) => {
  const { name, maxUsers } = req.body;

  if (!name) {
    throw httpError(400, 'name is required');
  }

  const room = await Room.create({
    name,
    ownerId: req.user.id,
    maxUsers, // undefined falls back to the schema default (12)
    members: [{ userId: req.user.id, role: 'owner' }],
  });

  res.status(201).json({
    id: room._id,
    name: room.name,
    ownerId: room.ownerId,
    maxUsers: room.maxUsers,
    role: 'owner',
  });
});

const getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw httpError(404, 'Room not found');
  }

  const role = room.getRole(req.user.id);
  if (!role) {
    // Spec §3: 403 if not a member and no valid invite has been redeemed yet.
    // Redemption happens via GET /invites/:token, which attaches membership
    // before the caller ever reaches this endpoint.
    throw httpError(403, 'Not a member of this room — redeem an invite first');
  }

  res.status(200).json({
    id: room._id,
    name: room.name,
    ownerId: room.ownerId,
    maxUsers: room.maxUsers,
    memberCount: room.members.length,
    role,
  });
});

const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw httpError(404, 'Room not found');
  }

  if (room.ownerId.toString() !== req.user.id) {
    throw httpError(403, 'Only the owner can delete the room');
  }

  await room.deleteOne();
  res.status(204).send();
});

// POST /rooms/:id/ws-ticket — req.room already loaded by requireRoomRole middleware
const issueWsTicket = asyncHandler(async (req, res) => {
  const ticket = await issueTicket({ userId: req.user.id, roomId: req.room._id.toString() });
  res.status(201).json({ ticket, expiresInSeconds: env.wsTicketTtlSeconds });
});

module.exports = { createRoom, getRoom, issueWsTicket };