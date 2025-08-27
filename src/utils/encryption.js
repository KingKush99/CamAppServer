// src/utils/encryption.js

// For development/testing: just return the raw private key as-is.
function decrypt(data) {
  // No decryption performed, just return what is stored in DB.
  return data;
}

// (Optional: You may still want a stub encrypt function for future use)
function encrypt(data) {
  return data;
}

module.exports = {
  decrypt,
  encrypt
};
