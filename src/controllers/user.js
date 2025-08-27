// src/routes/user.js (FINAL, SECURE VERSION)

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT generation
const config = require('../../config'); // Accessing server configuration
const db = require('../services/db'); // Database service layer
const { createCustodialWallet } = require('../services/blockchain'); // To create wallets for users
const authenticateToken = require('../middleware/authenticateToken'); // Middleware to protect routes
const { encrypt, decrypt } = require('../utils/encryption'); // For encrypting/decrypting sensitive data like private keys

// Register a new user
router.post('/register', async (req, res) => {
  const { email, password, username, display_name } = req.body;
  
  // Basic validation
  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, password, and username are required' });
  }

  try {
    // Hash the password for secure storage
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 1. Generate a new custodial wallet for the user
    const { address: custodialAddress, privateKey: custodialPrivateKey } = createCustodialWallet();
    
    // 2. Encrypt the private key before storing it
    const encryptedPrivateKey = encrypt(custodialPrivateKey);
    if (!encryptedPrivateKey) {
      // This error should ideally not happen if encryption utilities are set up correctly
      throw new Error("Private key encryption failed. Check server configuration.");
    }

    // 3. Create the user in the database with hashed password and encrypted private key
    const newUser = await db.createUser(email, hashedPassword, username, display_name, custodialAddress, encryptedPrivateKey);
    
    // Generate JWT token for immediate login upon successful registration
    const token = jwt.sign(
      { 
        id: newUser.id, 
        email: newUser.email, 
        username: newUser.username, 
        display_name: newUser.display_name, 
        custodial_address: newUser.custodial_address 
      }, 
      config.jwtSecret, 
      { expiresIn: '1h' } // Token expires after 1 hour
    );

    // Respond with success message, user details, and the JWT token
    res.status(201).json({ 
      message: 'User registered successfully', 
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        display_name: newUser.display_name,
        custodial_address: newUser.custodial_address
      }, 
      token 
    });
  } catch (error) {
    // Log the server-side error for debugging
    console.error('Server error during registration:', error);
    // Respond with an error message to the client
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find the user in the database by email
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // If credentials are valid, generate a JWT token
    const payload = { 
      id: user.id, 
      email: user.email, 
      username: user.username, 
      custodial_address: user.custodial_address 
    };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
    
    console.log(`User logged in: ${email}`); // Log successful login
    res.status(200).json({ message: 'Login successful', token });
  } catch (error)
  {
    console.error('Server error during login:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// Get authenticated user's profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Find the user based on the email from the authenticated JWT payload
        const user = await db.findUserByEmail(req.user.email); 
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Respond with user profile information
        res.status(200).json({ message: 'User profile retrieved', user: {
            id: user.id,
            email: user.email,
            username: user.username,
            display_name: user.display_name,
            custodial_address: user.custodial_address,
            profile_picture_url: user.profile_picture_url, // Assuming this column exists
            stream_status: user.stream_status,           // Assuming this column exists
            nova_coin_balance_offchain: user.nova_coin_balance_offchain, // Assuming this column exists
            created_at: user.created_at
        } });
    } catch (error) {
        console.error('Server error getting user profile:', error);
        res.status(500).json({ message: 'Server error getting profile', error: error.message });
    }
});

module.exports = router;