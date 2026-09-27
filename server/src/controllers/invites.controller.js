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

  const invite = await Invite.findOneAndUpdate(
    {
      token,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$usesSoFar', '$maxUses'] },
    },
    { $inc: { usesSoFar: 1 } },
    { new: true },
  );

  if (!invite) {
    const exists = await Invite.exists({ token });
    if (!exists) {
      throw httpError(404, 'Invite not found');
    }
    throw httpError(410, 'Invite expired or fully used');
  }

  const room = await Room.findById(invite.roomId);
  if (!room) {
    throw httpError(404, 'Room no longer exists');
  }

  let role = room.getRole(req.user.id);
  if (!role) {
    room.members.push({ userId: req.user.id, role: invite.role });
    await room.save();
    role = invite.role;

    // Keep this instance's in-memory role map current, and tell every other
    // instance too — a viewer who was just granted access shouldn't have to
    // wait for a reconnect to be recognized by a WS server they land on.
    roomState.setRole(room._id.toString(), req.user.id, role);
    redisBridge.publishPermissionUpdate(room._id.toString(), req.user.id, role).catch(() => {
      // Best-effort — other instances will still pick up the new role the
      // next time they lazily load this room's membership from Mongo.
    });
  }
  // Already a member (e.g. re-clicking an old invite link) — keep their
  // existing role rather than silently downgrading/upgrading it.

  res.status(200).json({ roomId: room._id, role });
});

module.exports = { createInvite, redeemInvite };