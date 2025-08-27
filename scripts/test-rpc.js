// test-rpc.js

require('dotenv').config({ path: '../.env' }); // Adjust path if your .env is elsewhere
const { ethers } = require("ethers");

// Use your AMOY_RPC_URL from .env
const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);

async function test() {
  try {
    const block = await provider.getBlockNumber();
  } catch (err) {
    console.error("❌ RPC failed:", err);
  }
}

test();
