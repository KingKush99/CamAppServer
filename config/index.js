// CamAppServer/config/index.js

// 1. Load environment variables from the .env file in the project root.
require('dotenv').config();

// Standard Node.js modules for file system operations
const path = require('path');
const fs = require('fs');

// 2. Load Contract Addresses
const addressesPath = path.join(__dirname, './deployed_addresses.json');
const contractAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

// 3. Helper Function to Load ABIs
const getAbi = (contractName) => {
  try {
    const abiPath = path.join(__dirname, `./abis/${contractName}.json`);
    const file = fs.readFileSync(abiPath, 'utf8');
    return JSON.parse(file).abi; 
  } catch (error) {
    console.error(`Error loading ABI for ${contractName}: ${error.message}`);
    // Return a default empty ABI or re-throw to stop the server
    throw new Error(`Could not load ABI for ${contractName}. Make sure the file exists.`);
  }
};

// 4. Export all Configuration Variables
module.exports = {
  amoyRpcUrl: process.env.AMOY_RPC_URL,
  adminPrivateKey: process.env.DEPLOYER_PRIVATE_KEY, 
  contractAddresses,
  getAbi,
  jwtSecret: process.env.JWT_SECRET,
};