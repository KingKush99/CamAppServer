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

function safeFormatUnits(val) {
  try {
    return val ? ethers.utils.formatUnits(val, 18) : 'N/A';
  } catch {
    return 'N/A';
  }
}

async function findActiveAuctions() {
  for (let id = 1; id <= 20; id++) { // You can increase this range if needed
    try {
      const auction = await auctionHouse.auctions(id);

      if (
        auction &&
        auction.nftAddress &&
        auction.nftAddress !== '0x0000000000000000000000000000000000000000'
      ) {
        console.log('----');
        console.log(`Auction ID: ${id}`);
        console.log(`NFT Address: ${auction.nftAddress}`);
        console.log(`Token ID: ${auction.tokenId?.toString()}`);
        // Safely print values
        console.log(`Starting Bid: ${safeFormatUnits(auction.startingBid)} NOVA`);
        console.log(`Highest Bid: ${safeFormatUnits(auction.highestBid)} NOVA`);
        console.log(`Ended: ${auction.ended}`);
        console.log(`End At: ${auction.endAt ? auction.endAt.toString() : 'N/A'}`);
        console.log('');
      }
    } catch (err) {
      console.error(`Error on auction ${id}:`, err.message);
    }
  }
}

findActiveAuctions();
