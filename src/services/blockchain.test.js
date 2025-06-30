// src/services/blockchain.test.js
// No .env setup needed here!
const { createCustodialWallet } = require('./blockchain.js');
const { ethers } = require('ethers');

describe('createCustodialWallet', () => {
  it('should return a valid wallet object', () => {
    const wallet = createCustodialWallet();
    expect(wallet).toHaveProperty('address');
    expect(ethers.isAddress(wallet.address)).toBe(true);
  });
});