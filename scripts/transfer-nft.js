const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider("https://polygon-amoy-bor-rpc.publicnode.com");
const privateKey = "0x6934ccfd698122dc11caac4fd5875786f7cbb2397f331b5a9084cee60b61da6d"; // <- This is your actual private key!
const signer = new ethers.Wallet(privateKey, provider);

const nftAddress = "0x12f4d09be9712C98Fb720dfa001BFb2a793C4DEF";
const abi = [
  "function safeTransferFrom(address from, address to, uint256 tokenId)"
];

const contract = new ethers.Contract(nftAddress, abi, signer);

async function main() {
  const tx = await contract.safeTransferFrom(
    "0x7c00e73d0c8cD8e036BE4b128d9a2454f3aaeD50", // address that owns NFT
    "0x4D7d7950cD7EaEe5bDcF6604552e67644Fe41018", // your D50 custodial address
    6, // <-- your tokenId
    {
      maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("40", "gwei")
    }
  );
  await tx.wait();
  console.log("Transfer complete!");
}

main();
