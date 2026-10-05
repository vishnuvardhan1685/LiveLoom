const bcrypt = require('bcrypt');
const User = require('../models/User');
const { signJwt } = require('../utils/jwt');
const httpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 10;

function toAuthResponse(user) {
    const token = signJwt({ sub: user._id, email: user.email, name: user.name });
    return {
        token,
        user: { id: user._id, email: user.email, name: user.name },
    };
}

const signup = asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    if(!email || !password || !name) {
        throw httpError(400, 'Missing required fields');
    }

    if(password.length < 8){
        throw httpError(400, 'Password must be at least 8 characters long');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email, passwordHash, name });
    res.status(201).json(toAuthResponse(user));
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if(!email || !password) {
        throw httpError(400, 'Missing Email or Password');
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if(!user){
        throw httpError(401, 'Invalid email or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if(!matches){
        throw httpError(401, 'Invalid email or password');
    }
    res.status(200).json(toAuthResponse(user));
});

const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        throw httpError(404, 'User not found');
    }
    res.status(200).json({ id: user._id, email: user.email, name: user.name });
});

const updateMe = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
        throw httpError(404, 'User not found');
    }

    if (name && name.trim()) {
        user.name = name.trim();
    }
    if (email && email.trim()) {
        const cleanEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (existing) {
            throw httpError(409, 'Email is already in use by another account');
        }
        user.email = cleanEmail;
    }
    if (password && password.trim()) {
        if (password.trim().length < 8) {
            throw httpError(400, 'Password must be at least 8 characters long');
        }
        user.passwordHash = await bcrypt.hash(password.trim(), SALT_ROUNDS);
    }

    await user.save();
    res.status(200).json(toAuthResponse(user));
});

module.exports = { signup, login, getMe, updateMe };