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
        },
        version: {
            type: Number,
            default: 0,
        }
    },
    { timestamps: true },
);

module.exports = mongoose.model('Document', documentSchema);