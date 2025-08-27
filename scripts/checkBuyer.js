require('dotenv').config();
const { ethers } = require('ethers');

const NOVA = '0x49fc118e0c9931f8b287292b2e61b571651f01ec'; // NovaCoin
const AUCTION = '0xf471af2aFF654A07CD9f55B6cfa22dD019FbaFEf';
const BUYER = '0xA87Cf0BD4B2837cbb9e59FcA83216C2Eb7b3d0c5';

const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)'
];

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const nova = new ethers.Contract(NOVA, erc20Abi, provider);

  const [bal, allowance] = await Promise.all([
    nova.balanceOf(BUYER),
    nova.allowance(BUYER, AUCTION),
  ]);

  console.log('NOVA balance:', ethers.utils.formatUnits(bal, 18));
  console.log('Allowance to AuctionHouse:', ethers.utils.formatUnits(allowance, 18));
})();
