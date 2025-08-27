// src/services/streamerService.js
const crypto = require('crypto');

const generateStreamKey = () => {
  const buffer = crypto.randomBytes(24);
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

module.exports = { generateStreamKey };