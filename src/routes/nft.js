//
// FILE: src/routes/nft.js (COMPLETE AND FINAL VERSION)
//

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const config = require('../../config');
const provider = new ethers.providers.JsonRpcProvider(config.amoyRpcUrl);
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const db = require('../services/db');
const { uploadJsonToIpfs } = require('../services/ipfsService');
const logger = require('../utils/logger');
const {
  createBlockchainProfile,
  approveProfileForSale,
  createAuctionForItem,
  makeOffer,
  cancelOffer,
  acceptOffer,
  transferInGameCurrency,
  getBalance,
  adminMintNFT,
  buyItem,
  placeBid,
  endAuction,
  nftAuctionHouseContract,
  adminMintForUser
} = require('../services/blockchain');
const { getPrivateKeyByUserId } = require('../services/db');

// --- NFT and Profile Creation ---
router.post('/create-profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { username, description } = req.body;
  if (!username || !description) {
    return res.status(400).json({ message: 'username and description are required.' });
  }
  try {
    const placeholderImageCid = 'QmXv2Y3tQxWcZqY9KcxkoRsXgcAV4H9SHgiiQme5ej3jUy';
    const metadata = { name: username, description: description, image: `ipfs://${placeholderImageCid}` };
    const ipfsCid = await uploadJsonToIpfs(metadata);
    const userEncryptedPrivateKey = await getPrivateKeyByUserId(userId);
    const result = await createBlockchainProfile(userEncryptedPrivateKey, username, ipfsCid);
    const nftContractAddress = config.contractAddresses.NovaProfiles;
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCid}`;
    await db.addNFT(nftContractAddress, result.tokenId, userId, username, description, metadataUrl);
    res.status(202).json({
      message: 'Profile creation process initiated successfully.',
      transactionHash: result.txHash,
      ipfsCid,
      tokenId: result.tokenId
    });
  } catch (error) {
    logger.error('Error in /create-profile endpoint:', error);
    res.status(500).json({ message: error.message || 'Failed to create profile' });
  }
});

// --- Offer and Bidding Routes ---
router.post('/make-offer', authenticateToken, async (req, res) => {
  const buyerId = req.user.id;
  const { listingId, amount } = req.body;
  if (listingId === undefined || !amount) {
    return res.status(400).json({ message: 'listingId and amount are required.' });
  }
  try {
    const listing = await db.getListingById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (listing.status !== 'active' && listing.status !== 'listed') {
        return res.status(400).json({ error: 'Listing is not active for offers.' });
    }
    const { nft_address, token_id, seller_id, seller_wallet_address } = listing;
    if (buyerId === seller_id) return res.status(400).json({ error: 'Cannot make an offer on your own listing.' });
    const userEncryptedPrivateKey = await getPrivateKeyByUserId(buyerId);
    const txHash = await makeOffer(userEncryptedPrivateKey, nft_address, token_id, amount, seller_wallet_address);
    await db.createOffer(listingId, buyerId, amount, nft_address, token_id, txHash);
    res.status(202).json({ message: 'Offer made successfully.', transactionHash: txHash });
  } catch (error) {
    logger.error('Error in /make-offer endpoint:', error);
    res.status(500).json({ message: error.message || 'Failed to make offer' });
  }
});

router.post('/cancel-offer', authenticateToken, async (req, res) => {
  const buyerId = req.user.id;
  const { offerId } = req.body;
  if (offerId === undefined) {
    return res.status(400).json({ message: 'offerId is required.' });
  }
  try {
    const offer = await db.getOfferById(offerId);
    if (!offer || offer.buyer_id !== buyerId || offer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer not found or cannot be cancelled.' });
    }
    const userEncryptedPrivateKey = await getPrivateKeyByUserId(buyerId);
    const txHash = await cancelOffer(userEncryptedPrivateKey, offer.nft_address, offer.token_id, offer.amount);
    await db.updateOfferStatus(offerId, 'cancelled', txHash);
    res.status(200).json({ message: 'Offer cancelled successfully.', transactionHash: txHash });
  } catch (error) {
    logger.error('Error in /cancel-offer endpoint:', error);
    res.status(500).json({ error: 'Failed to cancel offer.', details: error.message });
  }
});

router.post('/accept-offer', authenticateToken, async (req, res) => {
  const sellerId = req.user.id;
  const { offerId } = req.body;
  if (offerId === undefined) {
    return res.status(400).json({ message: 'offerId is required.' });
  }
  try {
    const offer = await db.getOfferById(offerId);
    if (!offer || offer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer not found or not pending.' });
    }
    if (offer.seller_id !== sellerId) {
         return res.status(403).json({ error: 'You are not the seller of this NFT.' });
    }
    const userEncryptedPrivateKey = await getPrivateKeyByUserId(sellerId);
    const txHash = await acceptOffer(userEncryptedPrivateKey, offer.nft_address, offer.token_id, offer.amount, offer.buyer_wallet_address);
    await db.updateOfferStatus(offerId, 'accepted', txHash);
    await db.updateListingStatus(offer.listing_id, 'sold');
    await db.updateNFTOwnership(offer.nft_address, offer.token_id, offer.buyer_id);
    res.status(200).json({ message: 'Offer accepted successfully.', transactionHash: txHash });
  } catch (error) {
    logger.error('Error in /accept-offer endpoint:', error);
    res.status(500).json({ error: 'Failed to accept offer.', details: error.message });
  }
});

// --- Listing and Auction Routes ---
router.post('/approve-listing', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { tokenId } = req.body;
  if (tokenId === undefined) {
    return res.status(400).json({ message: 'tokenId is required.' });
  }
  try {
    const userEncryptedPrivateKey = await getPrivateKeyByUserId(userId);
    const txHash = await approveProfileForSale(userEncryptedPrivateKey, tokenId);
    res.status(202).json({ message: 'Approval transaction sent.', transactionHash: txHash });
  } catch (error) {
    logger.error('Error in /approve-listing endpoint:', error);
    res.status(500).json({ message: error.message || 'Failed to send approval' });
  }
});

router.post('/list-item', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { tokenId, price } = req.body;
  if (tokenId === undefined || price === undefined) {
    return res.status(400).json({ message: 'tokenId and price are required.' });
  }
  try {
    const userEncryptedPrivateKey = await getPrivateKeyByUserId(userId);
    const result = await createAuctionForItem(userEncryptedPrivateKey, tokenId, price);
    const nftRecord = await db.getListingByTokenIdAndSellerId(tokenId, userId);
    if (!nftRecord) {
        return res.status(404).json({ message: 'NFT not found for this user.' });
    }
    let listingIdToUpdate;
    const existingListing = await db.getListingByNFTAndSeller(nftRecord.nft_address, tokenId, userId);
    if (existingListing) {
        listingIdToUpdate = existingListing.id;
    } else {
        const newListing = await db.createInitialListing(nftRecord.nft_address, tokenId, userId, parseFloat(price), 'active');
        listingIdToUpdate = newListing.id;
    }
    const auctionDetailsFromContract = await nftAuctionHouseContract.auctions(result.auctionId);
    const auctionEndTime = new Date(parseInt(auctionDetailsFromContract.endAt.toString()) * 1000);
    await db.updateListingWithAuctionDetails(listingIdToUpdate, result.auctionId, parseFloat(price), userId, auctionEndTime, 'active');
    res.status(202).json({ message: 'Item listing sent.', transactionHash: result.txHash, auctionId: result.auctionId });
  } catch (error) {
    logger.error('Error in /list-item endpoint:', error);
    res.status(500).json({ message: error.message || 'Failed to list item' });
  }
});

router.post('/buy-item', authenticateToken, async (req, res) => {
  const buyerId = req.user.id;
  const { auctionId } = req.body;
  if (auctionId === undefined) {
    return res.status(400).json({ message: 'auctionId is required.' });
  }
  try {
    const buyerEncryptedPrivateKey = await getPrivateKeyByUserId(buyerId);
    const listing = await db.getListingByAuctionContractId(auctionId);
    if (!listing) return res.status(404).json({ message: 'Auction not found.' });
    if (listing.status !== 'active') return res.status(400).json({ message: 'Auction is not active.' });
    const { txHash, newOwnerAddress } = await buyItem(buyerEncryptedPrivateKey, auctionId);
    const finalAuctionDetails = await nftAuctionHouseContract.auctions(auctionId);
    const winnerUser = await db.findUserByCustodialAddress(finalAuctionDetails.highestBidder);
    const winnerId = winnerUser ? winnerUser.id : null;
    const winningAmount = parseFloat(ethers.utils.formatUnits(finalAuctionDetails.highestBid, 18));
    await db.updateListingStatusAndWinner(listing.id, 'sold', txHash, winnerId, winningAmount);
    await db.updateNFTOwnership(listing.nft_address, listing.token_id, winnerId);
    res.status(200).json({ message: 'NFT purchase successful!', transactionHash: txHash, newOwnerAddress });
  } catch (error) {
    logger.error('Error buying NFT:', error);
    res.status(500).json({ message: error.message || 'Failed to purchase NFT.' });
  }
});

router.post('/auctions/bid', authenticateToken, async (req, res) => {
    const { auctionContractId, amount } = req.body;
    const userId = req.user.id;
    if (!auctionContractId || !amount) {
        return res.status(400).json({ message: 'Valid auctionId and bid amount are required.' });
    }
    try {
        const user = await db.getUserById(userId);
        const listing = await db.getListingByAuctionContractId(auctionContractId);
        if (!listing) return res.status(404).json({ message: 'Auction listing not found.' });
        if (listing.status !== 'active') return res.status(400).json({ message: 'Auction is not active for bidding.' });
        if (listing.seller_id === userId) return res.status(400).json({ message: 'You cannot bid on your own auction.' });
        const transactionHash = await placeBid(user.encrypted_private_key, auctionContractId, amount);
        await db.addBid({ auction_contract_id: auctionContractId, listing_id: listing.id, bidder_id: userId, amount: parseFloat(amount), transaction_hash: transactionHash, bid_time: new Date(), status: 'active' });
        await db.updateListingHighestBid(auctionContractId, parseFloat(amount), userId);
        res.status(200).json({ message: 'Bid placed successfully.', transactionHash });
    } catch (error) {
        logger.error(`API Error placing bid on auction ${auctionContractId}:`, error.message);
        res.status(500).json({ message: error.message || 'Failed to place bid.' });
    }
});

router.post('/auctions/end', authenticateToken, async (req, res) => {
    const { auctionContractId } = req.body;
    const sellerId = req.user.id;
    if (!auctionContractId) {
        return res.status(400).json({ message: 'Auction ID is required.' });
    }
    try {
        const user = await db.getUserById(sellerId);
        if (!user || !user.encrypted_private_key) return res.status(404).json({ message: 'Your wallet not found.' });
        const listing = await db.getListingByAuctionContractId(auctionContractId);
        if (!listing) return res.status(404).json({ message: 'Auction not found.' });
        if (listing.seller_id !== sellerId) return res.status(403).json({ message: 'You are not authorized.' });
        if (listing.status !== 'active') return res.status(400).json({ message: 'This auction is not active.' });
        const contractAuction = await nftAuctionHouseContract.auctions(auctionContractId);
        if (parseInt(contractAuction.endAt.toString()) * 1000 > Date.now()) return res.status(400).json({ message: 'Auction has not ended.' });
        if (contractAuction.ended) return res.status(400).json({ message: 'Auction is already settled.' });
        const transactionHash = await endAuction(user.encrypted_private_key, auctionContractId);
        const finalAuctionDetails = await nftAuctionHouseContract.auctions(auctionContractId);
        let winnerId = null;
        if (finalAuctionDetails.highestBidder !== ethers.constants.AddressZero) {
            const winnerUser = await db.findUserByCustodialAddress(finalAuctionDetails.highestBidder);
            winnerId = winnerUser ? winnerUser.id : null;
        }
        const winningAmount = finalAuctionDetails.highestBid.gt(0) ? parseFloat(ethers.utils.formatUnits(finalAuctionDetails.highestBid, 18)) : 0;
        const finalStatus = winnerId ? 'sold' : 'ended';
        await db.updateListingStatusAndWinner(listing.id, finalStatus, transactionHash, winnerId, winningAmount);
        if (winnerId) {
            await db.updateNFTOwnership(listing.nft_address, listing.token_id, winnerId);
        }
        res.status(200).json({ message: 'Auction ended successfully.', transactionHash, status: finalStatus });
    } catch (error) {
        logger.error(`API Error ending auction ${auctionContractId}:`, error.message);
        res.status(500).json({ message: error.message || 'Failed to end auction.' });
    }
});

// --- Admin-Only Routes ---
router.post('/admin/mint-nft', authenticateToken, isAdmin, async (req, res) => {
  const { targetAddress, username, description } = req.body;
  if (!targetAddress || !username || !description) return res.status(400).json({ message: 'All fields are required.' });
  try {
    const metadata = { name: username, description: description, image: `ipfs://QmXv2Y3tQxWcZqY9KcxkoRsXgcAV4H9SHgiiQme5ej3jUy` }; // Placeholder image
    const ipfsCid = await uploadJsonToIpfs(metadata);
    const result = await adminMintNFT(targetAddress, username, ipfsCid);
    const nftContractAddress = config.contractAddresses.NovaProfiles;
    const ownerUser = await db.findUserByCustodialAddress(targetAddress);
    if (!ownerUser) return res.status(404).json({ message: 'Target user not found.' });
    const ownerId = ownerUser.id;
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCid}`; // This should be image CID
    await db.addNFT(nftContractAddress, result.tokenId, ownerId, username, description, imageUrl);
    res.status(202).json({ message: `NFT minted successfully! Tx: ${result.txHash}`, transactionHash: result.txHash, tokenId: result.tokenId });
  } catch (error) {
    logger.error('Error in adminMintNFT endpoint:', error.message);
    res.status(500).json({ message: error.message || 'Failed to send NFT mint transaction.' });
  }
});

router.post('/admin/mint-tokens', authenticateToken, isAdmin, async (req, res) => {
  const { targetAddress, amount } = req.body;
  if (!targetAddress || !amount) return res.status(400).json({ message: 'targetAddress and amount are required.' });
  try {
    const txHash = await adminMintForUser(targetAddress, amount);
    // --- THIS IS THE FIX ---
    // Ensure the response includes the transactionHash in a structured way.
    res.status(200).json({ message: `Tokens minted successfully! Tx: ${txHash}`, transactionHash: txHash });
  } catch (error) {
    logger.error('Error in /admin/mint-tokens endpoint:', error);
    res.status(500).json({ message: 'Failed to mint tokens.', error: error.message });
  }
});

// --- General GET Routes for NFT Data ---
router.get('/auctions', async (req, res) => {
    const filters = {};
    const pagination = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.searchTerm) filters.search_term = req.query.searchTerm;
    pagination.limit = parseInt(req.query.limit || 10);
    pagination.offset = (parseInt(req.query.page || 1) - 1) * pagination.limit;
    try {
        const result = await db.getListings(filters, pagination);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve auctions.', error: error.message });
    }
});

router.get('/auctions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await db.getListingById(parseInt(id));
        if (!listing) {
            return res.status(404).json({ message: 'Auction not found.' });
        }
        res.status(200).json(listing);
    } catch (error) {
        logger.error(`Error fetching auction details for ID ${req.params.id}:`, error.message);
        res.status(500).json({ message: 'Failed to fetch auction details.' });
    }
});

// --- Utility Routes ---
router.post('/tip', authenticateToken, async (req, res) => {
  const senderId = req.user.id;
  const { recipientAddress, amount } = req.body;
  if (!recipientAddress || !amount) {
    return res.status(400).json({ message: 'Recipient address and amount are required.' });
  }
  try {
    const senderEncryptedPrivateKey = await getPrivateKeyByUserId(senderId);
    if (!senderEncryptedPrivateKey) {
      throw new Error('Sender private key not found in DB.');
    }
    const txHash = await transferInGameCurrency(senderEncryptedPrivateKey, recipientAddress, amount);
    res.status(200).json({ message: 'Tip sent successfully!', txHash });
  } catch (error) {
    logger.error('Tipping error:', error);
    res.status(500).json({ message: error.message || 'Failed to send tip' });
  }
});

router.get('/balance/:address', async (req, res) => {
  const { address } = req.params;
  try {
    const balance = await getBalance(address);
    res.json({ address, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;