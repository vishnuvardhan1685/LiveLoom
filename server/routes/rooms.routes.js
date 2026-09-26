const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { createRoom, getRoom, deleteRoom } = require('../controllers/rooms.controller');
const { create } = require('../models/Room');
const router = express.Router();

router.post('/', requireAuth, createRoom);
router.get('/:id', requireAuth, getRoom);

module.exports = router;