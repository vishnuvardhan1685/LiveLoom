const Room = require('../models/Room');
const httpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

// Fetches the room once, checks the caller's role against an allow-list, and
// attaches the room to the request object if the role is valid
const requireRoomRole = (allowedRoles) => {
    return asyncHandler(async (req, res, next) => {
        const room = await Room.findById(req.params.id);
        if(!room){
            throw httpError(404, 'Room not found');
        }
        const role = room.getRole(req.user.id);
        if(!role || !allowedRoles.includes(role)){
            throw httpError(403, 'Forbidden');
        }
        req.room = room;
        next();
    });
}

module.exports = requireRoomRole;