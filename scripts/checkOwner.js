// checkOwner.js
const { ethers } = require("ethers");
require('dotenv').config({ path: '../.env' }); // Edit path if needed

// ---- CONFIGURE THESE VALUES ----
const NFT_CONTRACT_ADDRESS = "0x12f4d09be9712C98Fb720dfa001BFb2a793C4DEF"; // Your ERC721 contract address
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology"; // Your RPC URL
const TOKEN_ID = 14; // <-- Set your tokenId here!

// ---- Minimal ABI for ownerOf ----
const abi = [
  "function ownerOf(uint256 tokenId) external view returns (address)"
];

// ---- SETUP PROVIDER & CONTRACT ----
async function main() {
  const provider = new ethers.providers.JsonRpcProvider(AMOY_RPC_URL, { name: "amoy", chainId: 80002 });
  const nft = new ethers.Contract(NFT_CONTRACT_ADDRESS, abi, provider);

  try {
    const owner = await nft.ownerOf(TOKEN_ID);
  } catch (err) {
    console.error(`Failed to fetch owner of tokenId ${TOKEN_ID}:`, err.reason || err.message || err);
  }
}

main();
