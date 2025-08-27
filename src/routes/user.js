//
// FILE: src/routes/user.js (COMPLETE AND FINAL VERSION)
//

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/db');
const { createCustodialWallet } = require('../services/blockchain');
const { encrypt } = require('../utils/encryption');
const config = require('../../config');
const authenticateToken = require('../middleware/authenticateToken');
const logger = require('../utils/logger');

// Registration Route
router.post('/register', async (req, res) => {
  const { email, password, username, displayName } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, password, and username are required.' });
  }

  try {
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { address, privateKey } = createCustodialWallet();
    const encryptedPrivateKey = encrypt(privateKey);
    const walletHash = await bcrypt.hash(privateKey, 10);
    const newUser = await db.createUser(email, passwordHash, username, displayName, address, encryptedPrivateKey, walletHash);

    // --- FIX IS HERE: Ensure 'role' is included in the JWT payload ---
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
      }
    });
  } catch (error) {
    logger.error('Error during user registration:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Login failed: Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Login failed: Invalid credentials.' });
    }
    
    logger.info(`User logged in: ${email}`);

    // --- FIX IS HERE: Ensure 'role' is included in the JWT payload ---
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        custodialAddress: user.custodial_address,
        role: user.role,
      }
    });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// Get User Profile Route (protected)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userProfile = await db.getUserProfile(userId);
    if (!userProfile) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    res.status(200).json(userProfile);
  } catch (error) {
    logger.error(`Error fetching profile for user ID ${req.user.id}:`, error);
    res.status(500).json({ message: 'Failed to retrieve user profile.', error: error.message });
  }
});

// Update User Profile Route (protected)
router.put('/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { displayName, bio, profilePictureUrl } = req.body;
  try {
    const updatedProfile = await db.updateUserProfile(userId, { displayName, bio, profilePictureUrl });
    if (!updatedProfile) {
      return res.status(404).json({ message: 'User not found or profile could not be updated.' });
    }
    res.status(200).json({
      message: 'Profile updated successfully.',
      user: updatedProfile
    });
  } catch (error)
 {
    logger.error(`Error updating profile for user ID ${userId}:`, error);
    res.status(500).json({ message: 'Failed to update user profile.', error: error.message });
  }
});

// GET ALL NFTs OWNED BY THE LOGGED-IN USER
router.get('/my-nfts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const nfts = await db.getNftsByOwnerId(userId);
    res.status(200).json(nfts);
  } catch (error) {
    logger.error(`Failed to retrieve NFT collection for user ID ${req.user.id}:`, error);
    res.status(500).json({ message: 'Server error while fetching your collection.' });
  }
});

module.exports = router;