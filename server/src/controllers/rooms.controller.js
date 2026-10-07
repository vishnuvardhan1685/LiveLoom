const Room           = require('../models/Room');
const DocumentModel  = require('../models/Document');
const Invite         = require('../models/Invite');
const httpError      = require('../utils/httpError');
const asyncHandler   = require('../utils/asyncHandler');
const { issueTicket } = require('../services/ticket.service');
const redisBridge    = require('../ws/redisBridge');
const logger         = require('../utils/logger');

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
  const room = await Room.findById(req.params.id).lean();
  if (!room) {
    throw httpError(404, 'Room not found');
  }

  if (room.ownerId.toString() !== req.user.id) {
    throw httpError(403, 'Only the owner can delete the room');
  }

  const roomId   = room._id.toString();
  const roomName = room.name;

  // ── 1. Delete DB records ──────────────────────────────────────────────────
  await Room.deleteOne({ _id: roomId });
  await DocumentModel.deleteOne({ roomId });
  await Invite.deleteMany({ roomId });
  logger.info(`[DELETE ROOM] DB records removed room=${roomId}`);

  // ── 2. Clear Redis active-count key ──────────────────────────────────────
  const { commandClient } = require('../config/redis');
  await commandClient.del(`room:${roomId}:activeCount`).catch((err) => {
    logger.error(`[DELETE ROOM] Failed to delete Redis key room:${roomId}:activeCount`, err);
  });
  logger.info(`[DELETE ROOM] Redis activeCount key cleared room=${roomId}`);

  // ── 3. Close local WS sockets + publish room:deleted to other instances ──
  // publishRoomDeleted triggers handleRoomDeleted on every instance (via Redis),
  // which closes local sockets and evicts the in-memory Y.Doc.
  await redisBridge.publishRoomDeleted(roomId, roomName);
  logger.info(`[DELETE ROOM] room:deleted published room=${roomId}`);

  // ── 4. Notify each member's dashboard via user-scoped SSE channel ────────
  const memberUserIds = room.members.map((m) => m.userId.toString());
  const notifyPayload = {
    type:     'room-deleted',
    roomId,
    roomName,
  };
  await Promise.all(
    memberUserIds.map((uid) => redisBridge.publishUserEvent(uid, notifyPayload)),
  );
  logger.info(`[DELETE ROOM] user events published to ${memberUserIds.length} member(s) room=${roomId}`);

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

// GET /rooms/:id/members — any member can read the member list
const getMembers = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id).populate('members.userId', 'name email');
  if (!room) throw httpError(404, 'Room not found');
  if (!room.getRole(req.user.id)) throw httpError(403, 'Not a member of this room');

  const members = (room.members || []).map((m) => ({
    userId: m.userId?._id?.toString() || m.userId?.toString(),
    name:   m.userId?.name  || m.userId?.email || 'Collaborator',
    email:  m.userId?.email || '',
    role:   m.role,
  }));

  res.status(200).json({ members, ownerId: room.ownerId.toString() });
});

// PATCH /rooms/:id/members/:userId  { role }  — owner only
const patchMemberRole = asyncHandler(async (req, res) => {
  const { id: roomId, userId: targetUserId } = req.params;
  const { role: newRole } = req.body;

  // Validate role value
  const EDITABLE_ROLES = ['editor', 'viewer'];
  if (!EDITABLE_ROLES.includes(newRole)) {
    throw httpError(400, `role must be one of: ${EDITABLE_ROLES.join(', ')}`);
  }

  const room = await Room.findById(roomId).populate('members.userId', 'name email');
  if (!room) throw httpError(404, 'Room not found');

  // Only the owner can change roles
  if (room.ownerId.toString() !== req.user.id) {
    throw httpError(403, 'Only the owner can change member roles');
  }

  // Cannot change the owner's own role
  if (targetUserId === req.user.id) {
    throw httpError(400, 'Cannot change the owner\'s role');
  }

  // Target must be a member
  const targetMember = room.members.find((m) => m.userId._id.toString() === targetUserId || m.userId.toString() === targetUserId);
  if (!targetMember) throw httpError(404, 'User is not a member of this room');

  // Cannot change the owner's role entry (double-guard for safety)
  if (targetMember.role === 'owner') {
    throw httpError(400, 'Cannot change the role of the owner');
  }

  // Resolve target user name for the toast
  const targetName = targetMember.userId?.name || targetMember.userId?.email || 'User';

  // Persist to MongoDB
  await Room.updateOne(
    { _id: roomId, 'members.userId': targetUserId },
    { $set: { 'members.$.role': newRole } },
  );
  logger.info(`[ROLE CHANGE] room=${roomId} target=${targetUserId} role=${newRole} by owner=${req.user.id}`);

  // Update live in-memory roleMap on ALL instances via permission:update
  await redisBridge.publishPermissionUpdate(roomId, targetUserId, newRole);

  // Push SSE role-changed event to the affected user
  await redisBridge.publishUserEvent(targetUserId, {
    type:     'role-changed',
    roomId,
    roomName: room.name,
    role:     newRole,
  });

  // Push SSE role-changed confirmation to the owner (different event shape so
  // the owner's toast says "Role of <name> changed to <role>")
  await redisBridge.publishUserEvent(req.user.id, {
    type:       'role-changed-ack',
    roomId,
    roomName:   room.name,
    targetName,
    targetUserId,
    role:       newRole,
  });

  res.status(200).json({ userId: targetUserId, role: newRole });
});

// DELETE /rooms/:id/members/:userId — owner only (remove a member from the room)
const removeMember = asyncHandler(async (req, res) => {
  const { id: roomId, userId: targetUserId } = req.params;

  const room = await Room.findById(roomId);
  if (!room) throw httpError(404, 'Room not found');

  if (room.ownerId.toString() !== req.user.id) {
    throw httpError(403, 'Only the owner can remove members');
  }

  if (targetUserId === req.user.id) {
    throw httpError(400, 'Owner cannot remove themselves');
  }

  const isMember = room.members.some((m) => m.userId.toString() === targetUserId);
  if (!isMember) throw httpError(404, 'User is not a member of this room');

  await Room.updateOne({ _id: roomId }, { $pull: { members: { userId: targetUserId } } });
  logger.info(`[REMOVE MEMBER] room=${roomId} removed user=${targetUserId} by owner=${req.user.id}`);

  // Notify removed user via SSE — they will see a "removed" toast
  await redisBridge.publishUserEvent(targetUserId, {
    type:     'room-deleted',   // reuse room-deleted flow: removes row + toast
    roomId,
    roomName: room.name,
  });

  res.status(204).send();
});

module.exports = { createRoom, getRoom, deleteRoom, listRooms, issueWsTicket, getMembers, patchMemberRole, removeMember };