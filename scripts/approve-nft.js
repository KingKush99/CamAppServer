require('dotenv').config({ path: '../.env' });
const { ethers } = require('ethers');

// ==== USER CONFIGURATION ====

// NFT contract address (Nova Profile NFT)
const NFT_CONTRACT_ADDRESS = "0x12f4d09be9712C98Fb720dfa001BFb2a793C4DEF";
// AuctionHouse contract address
const AUCTION_HOUSE_ADDRESS = "0x917Afe128C86b7e035eE665b858D4C0A07874232";

// Minimal ERC721 ABI for approval
const abi = [
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)"
];

async function main() {
  const rpcUrl = process.env.AMOY_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY; // <-- Make sure this is the D50 wallet private key!

  if (!rpcUrl) throw new Error("Missing AMOY_RPC_URL in .env");
  if (!privateKey || privateKey.length < 20) throw new Error("Missing or invalid D50_PRIVATE_KEY in .env");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, { name: "amoy", chainId: 80002 });
  const wallet = new ethers.Wallet(privateKey, provider);

  const nft = new ethers.Contract(NFT_CONTRACT_ADDRESS, abi, wallet);

  // Set manual gas prices to avoid "below minimum" error
  const maxPriorityFee = ethers.utils.parseUnits('30', 'gwei');
  const maxFee = ethers.utils.parseUnits('50', 'gwei');

  console.log("Sending setApprovalForAll...");
  const tx = await nft.setApprovalForAll(
    AUCTION_HOUSE_ADDRESS,
    true,
    {
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFee
    }
  );
  console.log("Approval transaction sent! Hash:", tx.hash);
  await tx.wait();
  console.log("Approval complete!");

  // Optional: Verify approval status
  const approved = await nft.isApprovedForAll(wallet.address, AUCTION_HOUSE_ADDRESS);
  console.log("Is approved for all?", approved);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
