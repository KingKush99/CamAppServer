//
// FILE: M:\Desktop\CamAppServer\src\middleware\authenticateToken.js (DEFINITIVELY CORRECTED)
//
'use strict';
const jwt = require('jsonwebtoken');
const config =require('../../config');
const logger = require('../utils/logger');
const db = require('../services/db'); // We need the database service here

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Get token from "Bearer <token>"

  if (token == null) {
    // If no token is provided, the user is not authenticated.
    return res.sendStatus(401); // Unauthorized
  }

  try {
    // 1. Verify the token is valid and not expired.
    // This decodes the payload we created during login, which includes the role.
    const decodedPayload = jwt.verify(token, config.jwtSecret);

    // 2. THIS IS THE CRITICAL STEP THAT WAS LIKELY MISSING:
    // For maximum security, we re-fetch the user from the database on every request.
    // This ensures that if a user's permissions have changed (e.g., they were demoted
    // from an admin), the change takes effect immediately.
    const user = await db.getUserById(decodedPayload.id);

    if (!user) {
      // If the user ID in the token no longer exists in the DB, the token is invalid.
      return res.sendStatus(403); // Forbidden
    }

    // 3. Attach the FULL, up-to-date user object from the database to the request.
    // This ensures that req.user contains the correct 'role'.
    req.user = user;

    next(); // The user is authenticated, proceed to the next middleware (like isAdmin).
  } catch (err) {
    // If jwt.verify fails (e.g., bad signature, expired token), block the request.
    logger.error('JWT Verification Error:', err.message);
    return res.sendStatus(403); // Forbidden
  }
};

module.exports = authenticateToken;