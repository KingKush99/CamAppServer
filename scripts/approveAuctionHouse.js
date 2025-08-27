require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);
const buyerWallet = new ethers.Wallet(process.env.BUYER_PRIVATE_KEY, provider);

const novaTokenAddress = "0x0e9ff5e782C5F980e0194BeaeE26139B9F098db8";  // <-- update this
const auctionHouseAddress = "0xf471af2aFF654A07CD9f55B6cfa22dD019FbaFEf";  // <-- update this
const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const amount = ethers.utils.parseUnits("1.0", 18); // Update as needed

const novaToken = new ethers.Contract(novaTokenAddress, erc20Abi, buyerWallet);

(async () => {
  const tx = await novaToken.approve(auctionHouseAddress, amount);
  console.log("Approval tx sent:", tx.hash);
  await tx.wait();
  console.log("Approval complete");
})();
