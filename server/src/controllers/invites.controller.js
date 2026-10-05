const Invite = require('../models/Invite');
const Room = require('../models/Room');
const httpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const roomState = require('../services/roomstate.service');
const redisBridge = require('../ws/redisBridge');

const INVITE_ROLES = ['editor', 'viewer'];

// POST /rooms/:id/invites — req.room already loaded + role-checked by requireRoomRole middleware
const createInvite = asyncHandler(async (req, res) => {
  const { role, expiresAt, maxUses } = req.body;

  if (!INVITE_ROLES.includes(role)) {
    throw httpError(400, `role must be one of: ${INVITE_ROLES.join(', ')}`);
  }
  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    throw httpError(400, 'expiresAt must be a valid date');
  }
  if (!Number.isInteger(maxUses) || maxUses < 1) {
    throw httpError(400, 'maxUses must be a positive integer');
  }

  const invite = await Invite.create({
    roomId: req.room._id,
    role,
    createdBy: req.user.id,
    expiresAt: new Date(expiresAt),
    maxUses,
  });

  res.status(201).json({
    token: invite.token,
    link: `/join/${invite.token}`,
    role: invite.role,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
  });
});

// GET /invites/:token — validates + atomically consumes one use, then attaches
// role membership to the caller. Uses a single conditional update instead of
// read-then-write so two people redeeming the last remaining use can't both
// succeed.
const redeemInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // First, look up the invite document (without consuming a use yet).
  const existing = await Invite.findOne({ token });

  if (!existing) {
    throw httpError(404, 'Invite not found');
  }

  // Check expiry and exhaustion before doing anything else.
  if (existing.expiresAt < new Date()) {
    throw httpError(410, 'Invite expired or fully used');
  }

  // Load the room so we can check existing membership.
  const room = await Room.findById(existing.roomId);
  if (!room) {
    throw httpError(404, 'Room no longer exists');
  }

  // If this user is already a member, return their current role without
  // consuming another use of the invite (idempotent re-redemption).
  const existingRole = room.getRole(req.user.id);
  if (existingRole) {
    return res.status(200).json({ roomId: room._id, role: existingRole });
  }

  // New member — atomically consume one use of the invite.
  // The $expr guard ensures two simultaneous final-use redemptions can't both win.
  const invite = await Invite.findOneAndUpdate(
    {
      _id: existing._id,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$usesSoFar', '$maxUses'] },
    },
    { $inc: { usesSoFar: 1 } },
    { new: true },
  );

  if (!invite) {
    // Another request raced us to the last slot — it's now exhausted.
    throw httpError(410, 'Invite expired or fully used');
  }

  // Admit the user.
  room.members.push({ userId: req.user.id, role: invite.role });
  await room.save();
  const role = invite.role;

  // Keep this instance's in-memory role map current, and tell every other
  // instance too — a viewer who was just granted access shouldn't have to
  // wait for a reconnect to be recognized by a WS server they land on.
  roomState.setRole(room._id.toString(), req.user.id, role);
  redisBridge.publishPermissionUpdate(room._id.toString(), req.user.id, role).catch(() => {
    // Best-effort — other instances will still pick up the new role the
    // next time they lazily load this room's membership from Mongo.
  });

  res.status(200).json({ roomId: room._id, role });
});

module.exports = { createInvite, redeemInvite };