const mongoose = require('mongoose');
const crypto = require('crypto');

const inviteSchema = new mongoose.Schema(
    {
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
        },
        role: {
            type: String,
            enum: ['owner', 'editor', 'viewer'],
            required: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
            default: () => crypto.randomBytes(16).toString('hex'),
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        maxUses: {
            type: Number,
            required: true,
        },
        usesSoFar: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false }
    }
);

inviteSchema.index({ roomId: 1 });

inviteSchema.methods.isExhausted = function isExhausted(){
    return this.usesSoFar >= this.maxUses || this.expiresAt.getTime() < Date.now();
};

module.exports = mongoose.model('Invite', inviteSchema);