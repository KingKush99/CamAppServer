// scripts/mintNova.js

require('dotenv').config(); // Loads .env variables

const { ethers } = require('ethers');
const path = require('path');
const config = require('../config'); // Adjust the path if needed

// === Setup Provider and Wallet ===
const provider = new ethers.providers.JsonRpcProvider(config.amoyRpcUrl);

const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!adminPrivateKey) {
  throw new Error('DEPLOYER_PRIVATE_KEY not found in .env');
}
const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

console.log("Admin wallet loaded:", adminWallet.address);

// === Load ABI ===
const novaCoinAbi = require('../config/abis/NovaCoin_ProgrammableSupply.json').abi;
const novaCoinAddress = config.contractAddresses.NovaCoin_ProgrammableSupply;
if (!novaCoinAddress) {
  throw new Error('NovaCoin_ProgrammableSupply address missing from config');
}

// === Main Mint Script ===
async function main() {
  console.log("Connecting to NovaCoin contract at:", novaCoinAddress);
  const novaCoinContract = new ethers.Contract(novaCoinAddress, novaCoinAbi, adminWallet);

  // You may need to adjust the function call if your contract is different!
  console.log("Sending mintScheduledSupply() transaction...");
  const gasOptions = {
    gasLimit: 200_000,
    maxFeePerGas: ethers.utils.parseUnits('250', 'gwei'),
    maxPriorityFeePerGas: ethers.utils.parseUnits('210', 'gwei'),
  };

  const tx = await novaCoinContract.mintScheduledSupply(gasOptions);
  console.log("Transaction hash:", tx.hash);

  await tx.wait(1);
  console.log("Mint completed! Check block explorer for details.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Mint error:", err);
    process.exit(1);
  });
