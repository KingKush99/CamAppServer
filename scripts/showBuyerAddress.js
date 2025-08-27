require('dotenv').config();
const { ethers } = require('ethers');

const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY;

if (!buyerPrivateKey) {
    console.error('BUYER_PRIVATE_KEY not set in .env!');
    process.exit(1);
}

const buyerWallet = new ethers.Wallet(buyerPrivateKey);
console.log('Buyer address:', buyerWallet.address);
