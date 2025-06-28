// Filename: CamAppServer/src/services/blockchain.js
// This service is the single point of contact between your server and your smart contracts.

const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
// This block loads the addresses and ABIs from the files you copied over.
const addressesPath = path.join(__dirname, '../../config/deployed_addresses.json');
const abisPath = path.join(__dirname, '../../config/abis/');

const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
// Helper function to load an ABI file dynamically
const getAbi = (contractName) => {
    const abiFilePath = path.join(abisPath, `${contractName}.json`);
    return JSON.parse(fs.readFileSync(abiFilePath, "utf8")).abi;
};

// Load credentials from this server's environment variables (.env file)
const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);

// This is your server's main wallet. It needs testnet MATIC for gas fees.
// CRITICAL: This private key should have minimal funds and be separate from your main deployer/founder wallet.
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// --- Create Reusable Contract Instances ---
const novaCoinContract = new ethers.Contract(addresses.NovaCoin_ProgrammableSupply, getAbi("NovaCoin_ProgrammableSupply"), adminWallet);
// You would add other contract instances here as you need them, for example:
// const novaMarketplaceContract = new ethers.Contract(addresses.NovaMarketplace, getAbi("NovaMarketplace"), adminWallet);


// --- CORE FUNCTIONS ---

/**
 * Creates a new, unique custodial wallet for a new user when they sign up.
 * @returns {object} An object containing the new wallet's address and its private key.
 */
async function createCustodialWallet() {
  const newWallet = ethers.Wallet.createRandom();
  console.log(`Created new custodial wallet: ${newWallet.address}`);
  // CRITICAL: In your real application, you MUST encrypt newWallet.privateKey with a strong
  // key (perhaps derived from the user's password) before storing it in your database.
  return {
    address: newWallet.address,
    privateKey: newWallet.privateKey,
  };
}

/**
 * Transfers NovaCoin between two custodial wallets. This is the engine for your in-game economy.
 * @param {string} senderPrivateKey - The DECRYPTED private key of the user sending the funds.
 * @param {string} recipientAddress - The public address of the user receiving the funds.
 * @param {string | number} amount - The human-readable amount of NovaCoin to send (e.g., 100).
 * @returns {string} The transaction hash of the successful transfer.
 */
async function transferInGameCurrency(senderPrivateKey, recipientAddress, amount) {
  // Create a temporary wallet instance for the sender to sign the transaction
  const senderWallet = new ethers.Wallet(senderPrivateKey, provider);
  
  // Connect to the NovaCoin contract using the SENDER's wallet. This is crucial.
  // It ensures the transaction is signed by them and comes from their custodial wallet.
  const userNovaCoinContract = novaCoinContract.connect(senderWallet);

  // Convert the human-readable amount to the smallest unit (wei)
  const amountInWei = ethers.parseUnits(amount.toString(), 18);

  console.log(`Initiating transfer of ${amount} NOVA from ${senderWallet.address} to ${recipientAddress}...`);
  
  // Perform the transfer. Note: The sender's custodial wallet must have enough NovaCoin to send
  // AND your server needs a system to fund their wallet with a tiny amount of MATIC for gas.
  const tx = await userNovaCoinContract.transfer(recipientAddress, amountInWei);
  
  // Wait for the transaction to be confirmed on the blockchain
  await tx.wait();

  console.log(`Transfer successful! Tx Hash: ${tx.hash}`);
  return tx.hash;
}

/**
 * Checks the NovaCoin balance of any wallet address.
 * @param {string} userAddress - The user's public wallet address.
 * @returns {string} The user's balance, formatted as a human-readable string (e.g., "123.45").
 */
async function getBalance(userAddress) {
    try {
        const balanceWei = await novaCoinContract.balanceOf(userAddress);
        return ethers.formatEther(balanceWei);
    } catch (error) {
        console.error(`Error fetching balance for ${userAddress}:`, error);
        return "0.0";
    }
}

// We export the functions so other parts of our server can use them.
module.exports = {
  createCustodialWallet,
  transferInGameCurrency,
  getBalance,
  // As you build features, you'll add more functions here, e.g.:
  // listNFTOnMarketplace(userKey, nftAddress, tokenId, price)
  // createAuction(userKey, nftAddress, tokenId, startingBid)
};