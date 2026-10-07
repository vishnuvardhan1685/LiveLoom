const mongoose = require('mongoose');

const ROLES = ['owner', 'editor', 'viewer'];

const memberSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        role: {
            type: String,
            enum: ROLES,
            required: true,
        },
    },
    { _id: false },
);

const roomSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        maxUsers: {
            type: Number,
            default: 12,
        },
        members: {
            type: [memberSchema],
            default: [],
        },
    },
    { timestamps: true },
);

roomSchema.index({ ownerId: 1 });
roomSchema.index({ 'members.userId': 1 });

roomSchema.statics.ROLES = ROLES;

roomSchema.methods.getRole = function getRole(userId) {
    const member = this.members.find((m) => m.userId.equals(userId));
    return member ? member.role : null;
};

module.exports = mongoose.model('Room', roomSchema);