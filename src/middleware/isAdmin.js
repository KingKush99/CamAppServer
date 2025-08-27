//
// FILE: src/middleware/isAdmin.js (NEW FILE)
//
'use strict';
const logger = require('../utils/logger');

const isAdmin = (req, res, next) => {
  // This middleware MUST run after 'authenticateToken'.
  if (!req.user) {
    logger.warn('isAdmin middleware ran without req.user. Ensure authenticateToken runs first.');
    return res.status(500).json({ message: 'User object not found in request.' });
  }

  if (req.user.role !== 'admin') {
    logger.warn(`Admin access DENIED for user ID: ${req.user.id} (role: ${req.user.role})`);
    return res.status(403).json({ message: 'Forbidden: You do not have administrator privileges.' });
  }

  logger.info(`Admin access GRANTED for user ID: ${req.user.id}`);
  next();
};

module.exports = isAdmin;