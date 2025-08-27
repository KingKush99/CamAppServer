//
// FILE: M:\Desktop\CamAppServer\config\index.js (COMPLETE AND FINAL VERSION)
//
const path = require('path');
const fs = require('fs');

// Define the correct path to your contractAddresses.json
const contractAddressesPath = path.resolve(__dirname, 'contractAddresses.json');
let contractAddresses = {};
try {
    // Attempt to load the contract addresses
    contractAddresses = JSON.parse(fs.readFileSync(contractAddressesPath, 'utf8'));
    console.log(`Successfully loaded contract addresses from: ${contractAddressesPath}`);
} catch (error) {
    console.error(`Error loading contractAddresses.json: ${error.message}. Using empty object.`);
    console.error(`Attempted path: ${contractAddressesPath}`);
}

// Function to get ABI based on contract name (from abis subfolder)
const getAbi = (contractName) => {
    const abiPath = path.resolve(__dirname, `abis/${contractName}.json`);
    if (fs.existsSync(abiPath)) {
        return require(abiPath).abi;
    }
    throw new Error(`ABI for ${contractName} not found at ${abiPath}`);
};

module.exports = {
    // Access environment variables using process.env
    jwtSecret: process.env.JWT_SECRET || 'a_fallback_secret_for_dev_only',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://devuser:devpassword@localhost:5432/devdb',
    amoyRpcUrl: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/',

    // Use DEPLOYER_PRIVATE_KEY from .env for the admin wallet
    adminPrivateKey: process.env.DEPLOYER_PRIVATE_KEY || '',

    port: process.env.PORT || 9020,

    // --- THIS IS THE CRITICAL FIX for the CORS error ---
    // It tells your backend to trust requests from your frontend.
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3334',

    // Export Pinata API Keys from environment variables
    pinataApiKey: process.env.PINATA_API_KEY || '',
    pinataApiSecret: process.env.PINATA_API_SECRET || '',

    // Export the loaded contract addresses and the getAbi function
    contractAddresses: contractAddresses,
    getAbi: getAbi
};