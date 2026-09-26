const Room = require('../models/Room');
const httpError = require('../utils/httperror');
const asyncHandler = require('../utils/asyncHandler');

const createRoom = asyncHandler(async (req, res) => {
    const { name, maxUsers } = req.body;
    if(!name) throw httpError(400, 'Room name is required');
    const room = await Room.create({
        name,
        ownerId: req.user.id, 
        maxUsers,
        members: [{ userId: req.user.id, role: 'owner' }],
    });
    res.status(201).json({
        room: {
            id: room._id,
            name: room.name,
            ownerId: room.ownerId,
            maxUsers: room.maxUsers,
            role: 'owner',
        }
    });
});

const getRoom = asyncHandler(async (req, res) => {
    const room = await Room.findById(req.params.id);
    if(!room) throw httpError(404, 'Room not found');
    const role = room.getRole(req.user.id);
    if(!role) throw httpError(403, 'Not a member of this room - redeem an invite first');

    res.status(200).json({
        id: room._id,
        name: room.name,
        ownerId: room.ownerId,
        maxUsers: room.maxUsers,
        role,
    });
});

module.exports = { createRoom, getRoom };