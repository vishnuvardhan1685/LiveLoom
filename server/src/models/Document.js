const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
            unique: true,
        },
        snapshot: {
            type: Buffer,
            required: true,
        },
        version: {
            type: Number,
            default: 0,
        }
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = mongoose.model('Document', documentSchema);