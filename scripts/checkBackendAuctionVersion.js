// scripts/checkBackendAuctionVersion.js
require('dotenv').config();
const { ethers } = require('ethers');

const addresses = require('../config/contractAddresses.json');
const abi = require('../config/abis/NFTAuctionHouse.json').abi;

const RPC = process.env.AMOY_RPC_URL || require('../config').amoyRpcUrl;

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const auction = new ethers.Contract(addresses.NFTAuctionHouse, abi, provider);

  try {
    const token = await auction.novaToken();
    console.log('ABI OK. novaToken():', token);
  } catch (e) {
    console.error('ABI still old (no novaToken). Update NFTAuctionHouse.json and restart.', e.message);
  }
})();
