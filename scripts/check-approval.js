// check-approval.js

require('dotenv').config({ path: '../.env' });
const { ethers } = require('ethers');

// ==== USER CONFIGURATION ====

// NFT contract address (Nova Profile NFT)
const nftAddress = "0x12f4d09be9712C98Fb720dfa001BFb2a793C4DEF";
// AuctionHouse contract address
const operator = "0x917Afe128C86b7e035eE665b858D4C0A07874232";
// Owner address (should be your D50 wallet, new NFT owner)
const owner = "0x4D7d7950cD7EaEe5bDcF6604552e67644Fe41018";

// Minimal ERC721 ABI for approval check
const abi = [
  "function isApprovedForAll(address owner, address operator) external view returns (bool)"
];

async function main() {
  const rpcUrl = process.env.AMOY_RPC_URL;
  if (!rpcUrl) throw new Error("Missing AMOY_RPC_URL in .env");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, { name: "amoy", chainId: 80002 });
  const nft = new ethers.Contract(nftAddress, abi, provider);

  // Debug log: print out exactly what is being checked
  console.log('Checking approval for', owner, operator, 'on contract', nftAddress);

  const approved = await nft.isApprovedForAll(owner, operator);

  console.log("Approval result:", approved);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
