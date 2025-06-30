// src/services/blockchain.js

const { ethers } = require('ethers');
const config = require('../../config'); // Use the central config file

// Initialize provider and admin wallet
const provider = new ethers.JsonRpcProvider(config.amoyRpcUrl);
const adminWallet = new ethers.Wallet(config.adminPrivateKey, provider);

// Load contract instances
const novaCoinContract = new ethers.Contract(
  config.contractAddresses.NovaCoin_ProgrammableSupply,
  config.getAbi('NovaCoin_ProgrammableSupply'),
  adminWallet // Connect adminWallet to sign transactions if needed
);

// Add other contract instances as you build them out
// e.g., const novaProfilesContract = new ethers.Contract(...);

console.log("All contracts loaded and instantiated.");

/**
 * Creates a new custodial wallet.
 * @returns {object} An object containing the new wallet's address and private key.
 */
const createCustodialWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  console.log(`Created new custodial wallet: ${wallet.address}`);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
};

/**
 * Gets the NovaCoin balance of a given address.
 * @param {string} address - The wallet address to check.
 * @returns {string} The formatted balance as a string.
 */
const getBalance = async (address) => {
  try {
    const balance = await novaCoinContract.balanceOf(address);
    return ethers.formatUnits(balance, 18); // NovaCoin has 18 decimals
  } catch (error) {
    console.error(`Failed to get balance for address ${address}:`, error);
    return "0.0"; // Return 0.0 on error
  }
};

/**
 * Transfers NovaCoin from a sender's custodial wallet to a recipient's address.
 * @param {string} senderPrivateKey - The private key of the sender's custodial wallet.
 * @param {string} recipientAddress - The address of the recipient.
 * @param {number|string} amount - The amount of NovaCoin to transfer (as a whole number or string, e.g., 10.5).
 * @returns {string} The transaction hash.
 */
const transferInGameCurrency = async (senderPrivateKey, recipientAddress, amount) => {
  console.log(`Initiating transfer of ${amount} NOVA to ${recipientAddress}...`);
  // Create a wallet instance for the sender to sign the transaction
  const senderWallet = new ethers.Wallet(senderPrivateKey, provider);

  // Connect the contract instance to the sender's wallet
  const contractWithSigner = novaCoinContract.connect(senderWallet);

  // Convert the amount to the correct unit (Wei for 18 decimals)
  const amountInWei = ethers.parseUnits(amount.toString(), 18);

  // Estimate gas (optional but good practice)
  const gasEstimate = await contractWithSigner.transfer.estimateGas(recipientAddress, amountInWei);
  console.log(`Estimated gas for transfer: ${gasEstimate.toString()}`);

  // Send the transaction
  const tx = await contractWithSigner.transfer(recipientAddress, amountInWei, {
    gasLimit: gasEstimate,
  });

  console.log(`Transaction sent. Hash: ${tx.hash}`);
  await tx.wait(); // Wait for the transaction to be mined
  console.log(`Transaction confirmed. Tip successfully sent on-chain.`);

  return tx.hash;
};

module.exports = {
  createCustodialWallet,
  getBalance,
  transferInGameCurrency,
};