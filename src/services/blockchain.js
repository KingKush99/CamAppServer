//
// FILE: src/services/blockchain.js (COMPLETE AND FINAL VERSION)
//
const { ethers } = require('ethers');
const config = require('../../config');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');
const { findUserByCustodialAddress } = require('./db');

// ABIs
const novaCoinAbi = require('../../config/abis/NovaCoin_ProgrammableSupply.json').abi;
const novaProfilesAbi = require('../../config/abis/NovaProfiles.json').abi;
const nftAuctionHouseAbi = require('../../config/abis/NFTAuctionHouse.json').abi;
const nftOfferBookAbi = require('../../config/abis/NFTOfferBook.json').abi;

// Contract Addresses
let contractAddresses = {};
try {
    const contractAddressesPath = path.resolve(__dirname, '../../config/contractAddresses.json');
    contractAddresses = JSON.parse(fs.readFileSync(contractAddressesPath, 'utf8'));
    logger.info(`blockchain.js: Successfully loaded contract addresses from: ${contractAddressesPath}`);
} catch (error) {
    logger.error(`blockchain.js: Error loading contractAddresses.json: ${error.message}.`);
}

// Provider and Wallets
const provider = new ethers.providers.JsonRpcProvider(config.amoyRpcUrl);
const adminWallet = new ethers.Wallet(config.adminPrivateKey, provider);

// Contracts
const novaCoinContract = new ethers.Contract(contractAddresses.NovaCoin_ProgrammableSupply, novaCoinAbi, adminWallet);
const novaProfilesContract = new ethers.Contract(contractAddresses.NovaProfiles, novaProfilesAbi, adminWallet);
const nftAuctionHouseContract = new ethers.Contract(contractAddresses.NFTAuctionHouse, nftAuctionHouseAbi, adminWallet);
const nftOfferBookContract = new ethers.Contract(contractAddresses.NFTOfferBook, nftOfferBookAbi, adminWallet);

logger.info('Contracts (from blockchain.js):');
logger.info('NOVA   : ' + contractAddresses.NovaCoin_ProgrammableSupply);
logger.info('Profiles: ' + contractAddresses.NovaProfiles);
logger.info('Auction : ' + contractAddresses.NFTAuctionHouse);
logger.info('OfferBk : ' + contractAddresses.NFTOfferBook);

// --- THIS IS THE FIX for the gas price error ---
// The Amoy network is congested. We are setting a higher, safer minimum tip.
const MIN_TIP_GWEI = Number(process.env.MIN_TIP_GWEI || 50);

// This new, more robust function will ensure our transactions meet the minimum gas price.
const getDynamicGasOptions = async (addr, gasLimit, currentNonce, maxGasPriceGweiCap = null) => {
  const nonce = currentNonce ?? await provider.getTransactionCount(addr, 'pending');
  const fee = await provider.getFeeData().catch(() => ({}));
  const opts = { nonce, gasLimit };

  const minTipWei = ethers.utils.parseUnits(String(MIN_TIP_GWEI), 'gwei');

  if (fee.maxFeePerGas && fee.maxPriorityFeePerGas) {
    // EIP-1559 transaction
    opts.maxPriorityFeePerGas = fee.maxPriorityFeePerGas;

    if (opts.maxPriorityFeePerGas.lt(minTipWei)) {
        logger.warn(`Provider's suggested tip is too low. Using configured minimum of ${MIN_TIP_GWEI} Gwei.`);
        opts.maxPriorityFeePerGas = minTipWei;
    }
    
    // Ensure lastBaseFeePerGas is not null before using it
    const lastBaseFee = fee.lastBaseFeePerGas || (await provider.getBlock('latest')).baseFeePerGas;
    if(lastBaseFee){
        opts.maxFeePerGas = lastBaseFee.mul(2).add(opts.maxPriorityFeePerGas);
    } else {
        // Fallback if base fee is still not available
        opts.maxFeePerGas = ethers.utils.parseUnits(String(MIN_TIP_GWEI * 2), 'gwei');
    }

  } else {
    // Legacy transaction
    opts.gasPrice = fee.gasPrice || (await provider.getGasPrice());
    
    if (opts.gasPrice.lt(minTipWei)) {
        logger.warn(`Provider's suggested gas price is too low. Using configured minimum of ${MIN_TIP_GWEI} Gwei.`);
        opts.gasPrice = minTipWei;
    }
  }

  if (maxGasPriceGweiCap !== null) {
      const cappedWei = ethers.utils.parseUnits(String(maxGasPriceGweiCap), 'gwei');
      if (opts.maxFeePerGas && opts.maxFeePerGas.gt(cappedWei)) {
        opts.maxFeePerGas = cappedWei;
      }
      if (opts.gasPrice && opts.gasPrice.gt(cappedWei)) {
        opts.gasPrice = cappedWei;
      }
  }

  return opts;
};


const toWei = (amount) => ethers.utils.parseUnits(String(amount), 18);

// --- API ---

const createCustodialWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  logger.info(`Created custodial wallet: ${wallet.address}`);
  return { address: wallet.address, privateKey: wallet.privateKey };
};

const getBalance = async (address) => {
  const bal = await novaCoinContract.balanceOf(address);
  return ethers.utils.formatUnits(bal, 18);
};

const transferInGameCurrency = async (encryptedSenderPrivateKey, recipientAddress, amount) => {
  const senderPrivateKey = decrypt(encryptedSenderPrivateKey);
  const senderWallet = new ethers.Wallet(senderPrivateKey, provider);
  const novaWithSender = novaCoinContract.connect(senderWallet);
  const amountWei = toWei(amount);
  const gas = await getDynamicGasOptions(senderWallet.address, 200000);
  const tx = await novaWithSender.transfer(recipientAddress, amountWei, gas);
  await tx.wait(1);
  return tx.hash;
};

const createBlockchainProfile = async (encryptedUserPrivateKey, username, ipfsCid) => {
  const contentHash = `ipfs://${ipfsCid}`;
  const userPrivateKey = decrypt(encryptedUserPrivateKey);
  const userWallet = new ethers.Wallet(userPrivateKey, provider);
  const profilesWithUser = novaProfilesContract.connect(userWallet);
  const bal = await provider.getBalance(userWallet.address);
  if (bal.eq(0)) throw new Error('Wallet has 0 POL. Cannot pay for gas.');
  try {
    const gas = await getDynamicGasOptions(userWallet.address, 300000);
    const tx = await profilesWithUser.createProfile(username, contentHash, gas);
    const receipt = await tx.wait();
    const profileCreatedEvent = receipt.events?.find(e => e.event === 'ProfileCreated');
    if (!profileCreatedEvent || !profileCreatedEvent.args) {
        throw new Error('ProfileCreated event not found in transaction receipt.');
    }
    const tokenId = profileCreatedEvent.args.tokenId.toString();
    logger.info(`Transaction confirmed. Profile created with tokenId: ${tokenId}`);
    return { txHash: tx.hash, tokenId: tokenId };
  } catch (error) {
    logger.error(`Error in createBlockchainProfile for ${username}:`, error);
    throw error;
  }
};

const approveProfileForSale = async (encryptedUserPrivateKey, tokenId) => {
  const userPrivateKey = decrypt(encryptedUserPrivateKey);
  const userWallet = new ethers.Wallet(userPrivateKey, provider);
  const profilesWithUser = novaProfilesContract.connect(userWallet);
  const approveGasOptions = await getDynamicGasOptions(userWallet.address, 150000, null, 50);
  const tx = await profilesWithUser.approve(nftAuctionHouseContract.address, tokenId, approveGasOptions);
  await tx.wait(1);
  return tx.hash;
};

const approveMaxNovaCoin = async (encryptedUserPrivateKey) => {
    try {
        const userPrivateKey = decrypt(encryptedUserPrivateKey);
        const userWallet = new ethers.Wallet(userPrivateKey, provider);
        const novaCoinWithUser = novaCoinContract.connect(userWallet);
        const maxUint256 = ethers.constants.MaxUint256;
        const gasOptions = await getDynamicGasOptions(userWallet.address, 70000);
        const tx = await novaCoinWithUser.approve(nftAuctionHouseContract.address, maxUint256, gasOptions);
        await tx.wait();
        return tx.hash;
    } catch (error) {
        logger.error('Error granting max approval for NovaCoin:', error);
        throw error;
    }
};

const createAuctionForItem = async (encryptedUserPrivateKey, tokenId, priceInNova) => {
  const userPrivateKey = decrypt(encryptedUserPrivateKey);
  const userWallet = new ethers.Wallet(userPrivateKey, provider);
  const auctionWithUser = nftAuctionHouseContract.connect(userWallet);
  const owner = await novaProfilesContract.ownerOf(tokenId);
  if (owner.toLowerCase() !== userWallet.address.toLowerCase()) {
    throw new Error(`You do not own this NFT. Owner: ${owner}.`);
  }
  const approved = await novaProfilesContract.getApproved(tokenId);
  if (approved.toLowerCase() !== nftAuctionHouseContract.address.toLowerCase()) {
    throw new Error('NFTAuctionHouse not approved for this NFT.');
  }
  const duration = 3600; // 2 minutes for testing
  const startBid = toWei(priceInNova);
  const gas = await getDynamicGasOptions(userWallet.address, 300000);
  const tx = await auctionWithUser.createAuction(novaProfilesContract.address, tokenId, startBid, duration, gas);
  const receipt = await tx.wait(1);
  let auctionId = 'Check logs';
  const evt = receipt.events?.find(e => e.event === 'AuctionCreated');
  if (evt?.args) {
    const id = evt.args.auctionId;
    if (id) auctionId = id.toString();
  }
  return { txHash: tx.hash, auctionId: auctionId };
};

const placeBid = async (encryptedBuyerPrivateKey, auctionId, bidAmountInNova) => {
    try {
        const buyerPrivateKey = decrypt(encryptedBuyerPrivateKey);
        const buyerWallet = new ethers.Wallet(buyerPrivateKey, provider);
        const amountWei = toWei(bidAmountInNova);
        const novaCoinWithBuyer = novaCoinContract.connect(buyerWallet);
        const approveGasOptions = await getDynamicGasOptions(buyerWallet.address, 70000);
        const approvalTx = await novaCoinWithBuyer.approve(nftAuctionHouseContract.address, amountWei, approveGasOptions);
        await approvalTx.wait();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const auctionHouseWithBuyer = nftAuctionHouseContract.connect(buyerWallet);
        const placeBidGasOptions = await getDynamicGasOptions(buyerWallet.address, 300000);
        const tx = await auctionHouseWithBuyer.placeBid(auctionId, amountWei, placeBidGasOptions);
        await tx.wait();
        return tx.hash;
    } catch (error) {
        logger.error("Error placing bid:", error);
        if (error.reason) throw new Error(`Blockchain transaction failed: ${error.reason}`);
        throw error;
    }
};

const endAuction = async (encryptedSellerPrivateKey, auctionId) => {
    try {
        const sellerPrivateKey = decrypt(encryptedSellerPrivateKey);
        const sellerWallet = new ethers.Wallet(sellerPrivateKey, provider);
        const auctionHouseWithSeller = nftAuctionHouseContract.connect(sellerWallet);
        const endAuctionGasOptions = await getDynamicGasOptions(sellerWallet.address, 300000);
        const tx = await auctionHouseWithSeller.endAuction(auctionId, endAuctionGasOptions);
        await tx.wait();
        return tx.hash;
    } catch (error) {
        logger.error("Error ending auction:", error);
        if (error.reason) throw new Error(`Blockchain transaction failed: ${error.reason}`);
        throw error;
    }
};

const makeOffer = async (encryptedBuyerPrivateKey, nftContractAddress, tokenId, offerAmountInNova, sellerAddress) => {
  const buyerPrivateKey = decrypt(encryptedBuyerPrivateKey);
  const buyerWallet = new ethers.Wallet(buyerPrivateKey, provider);
  const amountWei = toWei(offerAmountInNova);
  const novaWithBuyer = novaCoinContract.connect(buyerWallet);
  const offerBookWithBuyer = nftOfferBookContract.connect(buyerWallet);
  const gas1 = await getDynamicGasOptions(buyerWallet.address, 200000);
  const approveTx = await novaWithBuyer.approve(nftOfferBookContract.address, amountWei, gas1);
  await approveTx.wait(1);
  const gas2 = await getDynamicGasOptions(buyerWallet.address, 200000);
  const offerTx = await offerBookWithBuyer.makeOffer(nftContractAddress, tokenId, amountWei, sellerAddress, gas2);
  await offerTx.wait(1);
  return offerTx.hash;
};

const cancelOffer = async (encryptedBuyerPrivateKey, nftContractAddress, tokenId, offerAmountInNova) => {
  const buyerPrivateKey = decrypt(encryptedBuyerPrivateKey);
  const buyerWallet = new ethers.Wallet(buyerPrivateKey, provider);
  const offerBookWithBuyer = nftOfferBookContract.connect(buyerWallet);
  const amountWei = toWei(offerAmountInNova);
  const gas = await getDynamicGasOptions(buyerWallet.address, 200000);
  const tx = await offerBookWithBuyer.cancelOffer(nftContractAddress, tokenId, amountWei, gas);
  await tx.wait(1);
  return tx.hash;
};

const acceptOffer = async (encryptedSellerPrivateKey, nftContractAddress, tokenId, offerAmountInNova, buyerAddress) => {
  const sellerPrivateKey = decrypt(encryptedSellerPrivateKey);
  const sellerWallet = new ethers.Wallet(sellerPrivateKey, provider);
  const offerBookWithSeller = nftOfferBookContract.connect(sellerWallet);
  const profilesWithSeller = novaProfilesContract.connect(sellerWallet);
  const amountWei = toWei(offerAmountInNova);
  const gas1 = await getDynamicGasOptions(sellerWallet.address, 150000);
  const approveTx = await profilesWithSeller.approve(nftOfferBookContract.address, tokenId, gas1);
  await approveTx.wait(1);
  const gas2 = await getDynamicGasOptions(sellerWallet.address, 300000);
  const tx = await offerBookWithSeller.acceptOffer(nftContractAddress, tokenId, amountWei, buyerAddress, gas2);
  await tx.wait(1);
  return tx.hash;
};

const buyItem = async (encryptedBuyerPrivateKey, auctionId) => {
  const buyerPrivateKey = decrypt(encryptedBuyerPrivateKey);
  const buyerWallet = new ethers.Wallet(buyerPrivateKey, provider);
  const auction = await nftAuctionHouseContract.auctions(auctionId);
  const endAt = Number(auction.endAt?.toString?.() ?? '0');
  if (!endAt || Math.floor(Date.now() / 1000) > endAt || auction.ended) {
    throw new Error('Auction is not available for purchase.');
  }
  const priceWei = auction.highestBid;
  if (priceWei.eq(0)) throw new Error('Cannot Buy Now: No valid price set.');
  const novaWithBuyer = novaCoinContract.connect(buyerWallet);
  const gasA = await getDynamicGasOptions(buyerWallet.address, 200000);
  const approveTx = await novaWithBuyer.approve(nftAuctionHouseContract.address, priceWei, gasA);
  await approveTx.wait(1);
  const auctionWithBuyer = nftAuctionHouseContract.connect(buyerWallet);
  const gasB = await getDynamicGasOptions(buyerWallet.address, 300000);
  const buyTx = await auctionWithBuyer.buyNow(auctionId, gasB);
  await buyTx.wait(1);
  return { txHash: buyTx.hash, newOwnerAddress: buyerWallet.address };
};

const adminMintInitialSupply = async () => {
  const gas = await getDynamicGasOptions(adminWallet.address, 200000);
  const tx = await novaCoinContract.mintScheduledSupply(gas);
  await tx.wait(1);
  return tx.hash;
};

const adminMintNFT = async (targetAddress, username, ipfsCid) => {
  const contentHash = `ipfs://${ipfsCid}`;
  const existingBalance = await novaProfilesContract.balanceOf(targetAddress);
  if (existingBalance.gt(0)) {
    throw new Error(`Minting failed: This user already owns a profile NFT. The contract prevents duplicates.`);
  }
  const MIN_GAS = ethers.utils.parseEther('0.02');
  const userBalance = await provider.getBalance(targetAddress);
  if (userBalance.lt(MIN_GAS)) {
    logger.warn(`User ${targetAddress} has insufficient gas. Funding...`);
    const amountToFund = MIN_GAS.sub(userBalance);
    const fundTx = await adminWallet.sendTransaction({ to: targetAddress, value: amountToFund });
    await fundTx.wait(1);
    logger.info(`User ${targetAddress} funded with POL successfully.`);
  }
  const user = await findUserByCustodialAddress(targetAddress);
  if (!user?.encrypted_private_key) throw new Error(`User not found or no key for ${targetAddress}`);
  
  const userPrivateKey = decrypt(user.encrypted_private_key);
  const userWallet = new ethers.Wallet(userPrivateKey, provider);
  const profilesWithUser = novaProfilesContract.connect(userWallet);
  
  logger.info(`Minting NFT for ${username} from their wallet ${userWallet.address}...`);
  const gasOptions = await getDynamicGasOptions(userWallet.address, 300000);
  const tx = await profilesWithUser.createProfile(username, contentHash, gasOptions);
  
  const receipt = await tx.wait(1);
  const profileCreatedEvent = receipt.events?.find(e => e.event === 'ProfileCreated');
  if (!profileCreatedEvent || !profileCreatedEvent.args) throw new Error('Minted but could not parse tokenId');
  const tokenId = profileCreatedEvent.args.tokenId.toString();
  
  logger.info(`Mint successful for user ${targetAddress}. Tx hash: ${tx.hash}, TokenId: ${tokenId}`);
  return { txHash: tx.hash, tokenId };
};

const adminMintForUser = async (targetAddress, amount) => {
  const amountWei = toWei(amount);
  logger.info(`Admin TRANSFERRING ${amount} NOVA to ${targetAddress}...`);
  const gas = await getDynamicGasOptions(adminWallet.address, 100000);
  const tx = await novaCoinContract.transfer(targetAddress, amountWei, gas);
  await tx.wait(1);
  logger.info(`Transfer successful. Tx hash: ${tx.hash}`);
  return tx.hash;
};

module.exports = {
  createCustodialWallet,
  getBalance,
  transferInGameCurrency,
  createBlockchainProfile,
  approveProfileForSale,
  approveMaxNovaCoin,
  createAuctionForItem,
  makeOffer,
  cancelOffer,
  acceptOffer,
  buyItem,
  adminMintInitialSupply,
  adminMintNFT,
  placeBid,
  endAuction,
  provider,
  novaCoinContract,
  novaProfilesContract,
  nftAuctionHouseContract,
  nftOfferBookContract,
  adminMintForUser,
};