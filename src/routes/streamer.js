// src/routes/streamer.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { generateStreamKey } = require('../services/streamerService');
const authenticateToken = require('../middleware/authenticateToken');

// GET /api/streamer/settings - Get my own streamer settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT username, display_name, stream_key, payout_address FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching streamer settings:", error);
    res.status(500).json({ message: "Server error fetching settings." });
  }
});

// PUT /api/streamer/settings - Update my streamer settings
router.put('/settings', authenticateToken, async (req, res) => {
  const { payout_address } = req.body;
  if (!payout_address) {
    return res.status(400).json({ message: "payout_address is required." });
  }
  try {
    const { rows } = await db.query(
      'UPDATE users SET payout_address = $1 WHERE id = $2 RETURNING payout_address',
      [payout_address, req.user.id]
    );
    res.json({ message: 'Settings updated successfully', settings: rows[0] });
  } catch (error) {
    console.error("Error updating streamer settings:", error);
    res.status(500).json({ message: "Server error updating settings." });
  }
});

// POST /api/streamer/generate-key - Generate a new stream key for myself
router.post('/generate-key', authenticateToken, async (req, res) => {
  try {
    const newKey = generateStreamKey();
    await db.query('UPDATE users SET stream_key = $1 WHERE id = $2', [newKey, req.user.id]);
    res.json({ message: 'New stream key generated successfully.', stream_key: newKey });
  } catch (error) {
    console.error("Error generating stream key:", error);
    res.status(500).json({ message: "Server error generating key." });
  }
});

module.exports = router;