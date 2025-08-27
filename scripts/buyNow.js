require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);
const buyerWallet = new ethers.Wallet(process.env.BUYER_PRIVATE_KEY, provider);

const auctionHouseAddress = "0xf471af2aFF654A07CD9f55B6cfa22dD019FbaFEf"; // <-- update this
const auctionAbi = require('../config/abis/NFTAuctionHouse.json').abi;


const auctionHouse = new ethers.Contract(auctionHouseAddress, auctionAbi, buyerWallet);

const LISTING_ID = 1; // <-- update this to your auction/listing ID

(async () => {
  const tx = await auctionHouse.buyNow(LISTING_ID);
  console.log("Buy tx sent:", tx.hash);
  await tx.wait();
  console.log("NFT purchased!");
})().catch(console.error);
