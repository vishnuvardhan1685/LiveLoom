const Room = require('../models/Room');
const httpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { issueTicket } = require('../services/ticket.service');

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
  const room = await Room.findById(req.params.id).populate('members.userId', 'name email');
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

  const members = (room.members || []).map((m) => ({
    userId: m.userId?._id?.toString() || m.userId?.toString(),
    name: m.userId?.name || m.userId?.email || 'Collaborator',
    email: m.userId?.email || '',
    role: m.role,
  }));

  res.status(200).json({
    id: room._id,
    name: room.name,
    ownerId: room.ownerId,
    maxUsers: room.maxUsers,
    memberCount: room.members.length,
    members,
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

const listRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find({ 'members.userId': req.user.id });
  const result = rooms.map((room) => ({
    id: room._id,
    name: room.name,
    ownerId: room.ownerId,
    maxUsers: room.maxUsers,
    memberCount: room.members.length,
    role: room.getRole(req.user.id),
    createdAt: room.createdAt,
  }));
  res.status(200).json(result);
});

// POST /rooms/:id/ws-ticket — req.room already loaded by requireRoomRole middleware
const issueWsTicket = asyncHandler(async (req, res) => {
  const ticket = issueTicket({ userId: req.user.id, roomId: req.room._id.toString() });
  res.status(201).json({ ticket, expiresInSeconds: 600 });
});

module.exports = { createRoom, getRoom, deleteRoom, listRooms, issueWsTicket };