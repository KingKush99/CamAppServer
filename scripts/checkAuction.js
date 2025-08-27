require('dotenv').config();
const { ethers } = require('ethers');
const contractAddresses = require('../config/contractAddresses.json');
const auctionAbi = require('../config/abis/NFTAuctionHouse.json').abi;

const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);
const auctionHouse = new ethers.Contract(
  contractAddresses.NFTAuctionHouse,
  auctionAbi,
  provider
);

const listingId = 8; // change to your auction id

async function getAuctionInfo() {
  try {
    const auction = await auctionHouse.auctions(listingId);
    console.log('Auction Info:', auction);
    console.log('Starting Bid:', ethers.utils.formatUnits(auction.startingBid, 18), 'NOVA');
    console.log('Highest Bid:', ethers.utils.formatUnits(auction.highestBid, 18), 'NOVA');
    console.log('Ended:', auction.ended);
    console.log('End At:', auction.endAt.toString());
  } catch (err) {
    console.error('Error fetching auction info:', err);
  }
}

getAuctionInfo();
