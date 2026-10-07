const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { redeemInvite } = require('../controllers/invites.controller');

const router = express.Router();

router.get('/:token', requireAuth, redeemInvite);
router.post('/:token', requireAuth, redeemInvite);

module.exports = router;