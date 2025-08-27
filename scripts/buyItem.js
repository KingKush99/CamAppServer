require('dotenv').config();
const { ethers } = require('ethers');
const contractAddresses = require('../config/contractAddresses.json');
const novaCoinAbi = require('../config/abis/NovaCoin_ProgrammableSupply.json').abi;
const auctionAbi = require('../config/abis/NFTAuctionHouse.json').abi;

// -------- CONFIG --------
const AMOY_RPC_URL = process.env.AMOY_RPC_URL;
const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY;
const LISTING_ID = 1; // <-- Set to the auction/listing ID you want to buy

if (!AMOY_RPC_URL) throw new Error('Missing AMOY_RPC_URL in .env');
if (!BUYER_PRIVATE_KEY) throw new Error('Missing BUYER_PRIVATE_KEY in .env');

const provider = new ethers.providers.JsonRpcProvider(AMOY_RPC_URL);
const buyerWallet = new ethers.Wallet(BUYER_PRIVATE_KEY, provider);

const novaCoin = new ethers.Contract(
  contractAddresses.NovaCoin_ProgrammableSupply,
  novaCoinAbi,
  buyerWallet
);

const auctionHouse = new ethers.Contract(
  contractAddresses.NFTAuctionHouse,
  auctionAbi,
  buyerWallet
);

async function main() {
  // Step 1: Get auction details
  const auction = await auctionHouse.auctions(LISTING_ID);

  // Print important auction info
  console.log('--- Auction Info ---');
  console.log('NFT Address:', auction.nftAddress);
  console.log('Token ID:', auction.tokenId.toString());
  console.log('Highest Bid:', ethers.utils.formatUnits(auction.highestBid, 18), 'NOVA');
  console.log('Ended:', auction.ended);
  console.log('End At:', auction.endAt.toString());

  // Step 2: Approve AuctionHouse to spend NOVA (if not already approved)
  const bidAmount = auction.highestBid;
  if (bidAmount.isZero()) {
    console.error('Highest bid is zero; cannot buy. Was the auction created?');
    return;
  }

  const allowance = await novaCoin.allowance(buyerWallet.address, auctionHouse.address);
  if (allowance.lt(bidAmount)) {
    console.log('Approving AuctionHouse to spend NOVA...');
    const approveTx = await novaCoin.approve(auctionHouse.address, bidAmount);
    console.log('Approval tx sent:', approveTx.hash);
    await approveTx.wait();
    console.log('Approval confirmed.');
  } else {
    console.log('Sufficient allowance already set.');
  }

  // Step 3: Buy the NFT
  try {
    // Optionally simulate:
    // await auctionHouse.callStatic.buyNow(LISTING_ID);

    const buyTx = await auctionHouse.buyNow(LISTING_ID);
    console.log('Buy tx sent:', buyTx.hash);
    await buyTx.wait();
    console.log('NFT purchase successful!');
  } catch (err) {
    console.error('Buy failed:', err.reason || err.message, err);
  }
}

main().catch(console.error);
