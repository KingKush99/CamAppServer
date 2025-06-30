// src/routes/user.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { createCustodialWallet, transferInGameCurrency, getBalance } = require('../services/blockchain'); 
const config = require('../../config'); 

const router = express.Router();

const usersDb = []; 
console.log("WARNING: Using in-memory database simulation (usersDb). Data will not persist.");

const JWT_SECRET = config.jwtSecret; 
const JWT_EXPIRATION = '1h'; 

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 
  if (token == null) return res.sendStatus(401); 
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); 
    req.user = user; 
    next(); 
  });
};

router.post('/register', async (req, res) => {
  const { email, password, username, display_name } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, password, and username are required' });
  }
  if (usersDb.find(user => user.email === email || user.username === username)) {
    return res.status(409).json({ message: 'User with this email or username already exists' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10); 
    const { address, privateKey } = createCustodialWallet();
    const encryptedPrivateKey = privateKey;
    console.warn("SECURITY WARNING: Private key is stored unencrypted in this example! Implement strong encryption!");
    const newUser = { id: usersDb.length + 1, email, username, display_name: display_name || username, password_hash: hashedPassword, custodial_address: address, encrypted_private_key: encryptedPrivateKey, created_at: new Date(), stream_status: 'offline' };
    usersDb.push(newUser); 
    console.log(`User registered: ${email}, Wallet: ${address}`);
    return res.status(201).json({ message: 'User registered successfully', user: { id: newUser.id, email: newUser.email, username: newUser.username, display_name: newUser.display_name, custodial_address: newUser.custodial_address } });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = usersDb.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  try {
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const payload = { id: user.id, email: user.email, username: user.username, custodial_address: user.custodial_address };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    console.log(`User logged in: ${email}`);
    return res.json({ message: 'Logged in successfully', token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const userProfile = usersDb.find(u => u.id === req.user.id);
  if (!userProfile) return res.status(404).json({ message: 'User not found' });
  const { password_hash, encrypted_private_key, ...safeUserProfile } = userProfile;
  res.json({ message: 'User profile retrieved', user: safeUserProfile });
});

router.post('/tip', authenticateToken, async (req, res) => {
  const { recipientId, amount } = req.body;
  const senderId = req.user.id;
  if (!recipientId || !amount) return res.status(400).json({ message: 'Recipient ID and amount are required' });
  if (senderId === recipientId) return res.status(400).json({ message: 'Cannot tip yourself' });
  const tipAmount = parseFloat(amount);
  if (isNaN(tipAmount) || tipAmount <= 0) return res.status(400).json({ message: 'Invalid tip amount' });
  const sender = usersDb.find(u => u.id === senderId);
  const recipient = usersDb.find(u => u.id === parseInt(recipientId));
  if (!sender || !recipient) return res.status(404).json({ message: 'Sender or recipient not found' });
  const senderPrivateKey = sender.encrypted_private_key;
  console.warn("SECURITY WARNING: Using unencrypted private key for transfer!");
  try {
    const txHash = await transferInGameCurrency(senderPrivateKey, recipient.custodial_address, tipAmount);
    
    // --- IMPROVED BALANCE FETCHING ---
    // Run balance checks in parallel for speed
    const balances = await Promise.all([
        getBalance(sender.custodial_address),
        getBalance(recipient.custodial_address)
    ]);
    
    return res.status(200).json({
        message: 'Tip sent successfully!',
        txHash: txHash,
        senderBalance: balances[0],
        recipientBalance: balances[1],
    });

  } catch (error) {
    console.error('Tipping error:', error);
    // If the tip fails on-chain, return a specific error
    if (error.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ message: 'Tipping failed: Insufficient funds for gas or tokens.', error: error.message });
    }
    return res.status(500).json({ message: 'Failed to send tip', error: error.message });
  }
});

module.exports = router;