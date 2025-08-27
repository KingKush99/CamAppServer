//
// FILE: src/routes/userRoutes.js
//
'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/db');
const { createCustodialWallet } = require('../services/blockchain');
const { encrypt } = require('../utils/encryption');
const config = require('../../config');
const logger = require('../utils/logger');
const authenticateToken = require('../middleware/authenticateToken');

// POST /api/users/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        if (!email || !password || !username) {
            return res.status(400).json({ message: 'Email, password, and username are required.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const { address, privateKey } = createCustodialWallet();
        const encryptedPrivateKey = encrypt(privateKey);
        const walletHash = "v1"; // Or your hashing mechanism
        await db.createUser(email, hashedPassword, username, username, address, encryptedPrivateKey, walletHash);
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed.' });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.findUserByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const payload = { id: user.id, username: user.username, email: user.email, role: user.role };
        const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' });
        res.json({
            message: 'Login successful',
            token: token,
            user: { id: user.id, email: user.email, username: user.username, custodialAddress: user.custodial_address, role: user.role }
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /api/users/profile (for the logged-in user)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userProfile = await db.getUserProfile(req.user.id);
        if (!userProfile) return res.status(404).json({ message: 'User profile not found.' });
        res.json(userProfile);
    } catch (error) {
        logger.error(`Error fetching profile for user ${req.user.id}:`, error);
        res.status(500).json({ message: 'Failed to fetch user profile.' });
    }
});

// GET /api/users/profile/:username (for any user's public profile)
router.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const userProfile = await db.findUserByUsername(username);
        if (!userProfile) return res.status(404).json({ message: 'User not found.' });
        res.json(userProfile);
    } catch (error) {
        logger.error(`Error fetching public profile for ${req.params.username}:`, error);
        res.status(500).json({ message: 'Failed to fetch public profile.' });
    }
});

// GET /api/users/my-nfts (for the logged-in user's collection)
router.get('/my-nfts', authenticateToken, async (req, res) => {
    try {
        const nfts = await db.getNftsByOwnerId(req.user.id);
        res.json(nfts);
    } catch (error) {
        logger.error(`Error fetching NFTs for user ${req.user.id}:`, error);
        res.status(500).json({ message: "Failed to fetch user's NFTs." });
    }
});

module.exports = router;