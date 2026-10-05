const express = require('express');
const { signup, login, getMe, updateMe } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);

module.exports = router;