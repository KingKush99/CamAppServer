//
// FILE: M:\Desktop\CamAppServer\src\services\db.js (COMPLETE AND FINAL VERSION)
//
const { Pool } = require('pg');
const config = require('../../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('connect', (client) => {
  logger.info('Pool Event: A client connected successfully!');
});

pool.on('error', (err, client) => {
  logger.error('Pool Event: Unexpected error on idle client', err);
});

const testQuery = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    logger.info('Successfully connected to the PostgreSQL database!');
    logger.info('Dummy query result (current DB time):', res.rows[0].now);
  } catch (err) {
    logger.error('Error executing test query to PostgreSQL:', err.stack);
  }
};
testQuery();

const query = (text, params) => pool.query(text, params);

// --- User Management Functions ---
const createUser = async (
  email,
  passwordHash,
  username,
  displayName,
  custodialAddress,
  encryptedPrivateKey,
  walletHash
) => {
  const client = await pool.connect();
  try {
    const insertQuery = `
      INSERT INTO users(email, password_hash, username, display_name, custodial_address, encrypted_private_key, created_at, wallet_hash)
      VALUES($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING id, email, username, display_name, custodial_address, wallet_hash, role;
    `;
    const values = [email, passwordHash, username, displayName, custodialAddress, encryptedPrivateKey, walletHash];
    const res = await client.query(insertQuery, values);
    logger.info(`User created with ID: ${res.rows[0].id}, Email: ${email}`);
    return res.rows[0];
  } catch (error) {
    logger.error('Error creating user in DB:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// --- THIS IS THE CRITICAL FIX for the 'role: undefined' error ---
// This query now explicitly and reliably fetches the 'role' column needed for login.
const findUserByEmail = async (email) => {
  const client = await pool.connect();
  try {
    const findQuery = 'SELECT id, email, password_hash, username, display_name, custodial_address, encrypted_private_key, created_at, wallet_hash, role FROM users WHERE email = $1';
    const res = await client.query(findQuery, [email]);
    return res.rows[0];
  } catch (error) {
    logger.error('Error finding user by email:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

const findUserByUsername = async (username) => {
  const client = await pool.connect();
  try {
    const findQuery = 'SELECT id, username, display_name, custodial_address, bio, profile_picture_url, created_at FROM users WHERE username = $1';
    const res = await client.query(findQuery, [username]);
    return res.rows[0];
  } catch (error) {
    logger.error(`Error finding user by username ${username}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

async function getUserById(userId) {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, email, username, display_name, custodial_address, encrypted_private_key, created_at, wallet_hash, bio, profile_picture_url, role
            FROM users
            WHERE id = $1;
        `;
        const result = await client.query(query, [userId]);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error in getUserById(${userId}):`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

const findUserByCustodialAddress = async (address) => {
  const client = await pool.connect();
  try {
    const findQuery = 'SELECT id, email, password_hash, username, display_name, custodial_address, encrypted_private_key, created_at, wallet_hash, role FROM users WHERE LOWER(custodial_address) = LOWER($1)';
    const res = await client.query(findQuery, [address]);
    if (!res.rows[0]) {
      logger.warn(`No user found for custodial address: ${address}`);
      return null;
    }
    return res.rows[0];
  } catch (error) {
    logger.error(`Error finding user by custodial address (${address}):`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

const getPrivateKeyByUserId = async (userId) => {
  const client = await pool.connect();
  try {
    const query = 'SELECT encrypted_private_key FROM users WHERE id = $1';
    const res = await client.query(query, [userId]);
    if (res.rows.length === 0) {
      throw new Error('User not found.');
    }
    const privateKey = res.rows[0].encrypted_private_key;
    if (!privateKey) {
      throw new Error('Private key not found for this user.');
    }
    return privateKey;
  } catch (error) {
    logger.error(`Error fetching private key for user ${userId} from DB:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

// --- User Profile Functions ---
const updateUserProfile = async (userId, { displayName, bio, profilePictureUrl }) => {
  const client = await pool.connect();
  try {
    const query = `
      UPDATE users
      SET display_name = COALESCE($1, display_name),
          bio = COALESCE($2, bio),
          profile_picture_url = COALESCE($3, profile_picture_url),
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, email, username, display_name, custodial_address, bio, profile_picture_url, role;
    `;
    const values = [displayName, bio, profilePictureUrl, userId];
    const result = await client.query(query, values);
    logger.info(`User profile updated for userId: ${userId}`);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error updating user profile for userId ${userId} in DB:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

const getUserProfile = async (userId) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT id, email, username, display_name, custodial_address AS wallet_address, bio, profile_picture_url, role
      FROM users
      WHERE id = $1;
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching user profile for userId ${userId} from DB:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

// --- NFT and Listing Functions ---
async function getNftsByOwnerId(ownerId) {
    const client = await pool.connect();
    try {
        const queryText = `
            SELECT 
                id, contract_address, token_id, owner_id, name, description, image_url, metadata_cid, created_at
            FROM nfts 
            WHERE owner_id = $1
            ORDER BY created_at DESC;
        `;
        const result = await client.query(queryText, [ownerId]);
        return result.rows;
    } catch (error) {
        logger.error(`Database error in getNftsByOwnerId for owner ${ownerId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function addNFT(contractAddress, tokenId, ownerId, name, description, imageUrl) {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO nfts (contract_address, token_id, owner_id, name, description, image_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *;
        `;
        const values = [contractAddress, tokenId, ownerId, name, description, imageUrl];
        const res = await client.query(insertQuery, values);
        logger.info(`NFT added to DB: Token ID ${tokenId}, Owner ID ${ownerId}.`);
        return res.rows[0];
    } catch (error) {
        logger.error(`Error adding NFT to DB (Token ID ${tokenId}):`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function createInitialListing(nftAddress, tokenId, sellerId, initialPrice, status) {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO listings (nft_address, token_id, seller_id, current_price, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING *;
        `;
        const values = [nftAddress, tokenId, sellerId, initialPrice, status];
        const res = await client.query(insertQuery, values);
        logger.info(`Initial listing created for NFT ${tokenId}.`);
        return res.rows[0];
    } catch (error) {
        logger.error(`Error creating initial listing for NFT ${tokenId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function getListingByTokenIdAndSellerId(tokenId, sellerId) {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, contract_address AS nft_address, token_id, owner_id AS seller_id
            FROM nfts
            WHERE token_id = $1 AND owner_id = $2
            LIMIT 1;
        `;
        const result = await client.query(query, [tokenId, sellerId]);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error getting NFT by tokenId ${tokenId} and ownerId ${sellerId} from 'nfts' table:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function getListingByNFTAndSeller(nftAddress, tokenId, sellerId) {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, nft_address, token_id, seller_id, status
            FROM listings
            WHERE nft_address = $1 AND token_id = $2 AND seller_id = $3
            LIMIT 1;
        `;
        const result = await client.query(query, [nftAddress, tokenId, sellerId]);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error getting existing listing for NFT address (${nftAddress}), tokenId ${tokenId}, sellerId ${sellerId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function updateListingWithAuctionDetails(
    listingId,
    auctionContractId,
    initialHighestBidAmount,
    initialHighestBidderId,
    auctionEndTime,
    status = 'active'
) {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE listings
            SET auction_contract_id = $1,
                highest_bid_amount = $2,
                highest_bidder_id = $3,
                auction_end_time = $4,
                status = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING *;
        `;
        const values = [
            auctionContractId,
            initialHighestBidAmount,
            initialHighestBidderId,
            auctionEndTime,
            status,
            listingId
        ];
        const result = await client.query(query, values);
        logger.info(`Listing ${listingId} updated with auction details.`);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error updating listing ${listingId} with auction details:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

const updateListingStatus = async (listingId, status) => {
    const client = await pool.connect();
    try {
        const query = `UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`;
        const result = await client.query(query, [status, listingId]);
        logger.info(`Listing ${listingId} status updated to '${status}'.`);
        return result.rows[0];
    } finally {
        client.release();
    }
};

async function updateListingStatusAndWinner(listingId, status, transactionHash, winnerId = null, winningAmount = null) {
    const client = await pool.connect();
    try {
        let queryText = `
            UPDATE listings
            SET status = $1,
                transaction_hash = $2,
                updated_at = NOW()
        `;
        const values = [status, transactionHash];
        let paramIndex = 3;

        if (winnerId !== null) {
            queryText += `, winner_id = $${paramIndex++}`;
            values.push(winnerId);
        }
        if (winningAmount !== null) {
            queryText += `, winning_amount = $${paramIndex++}`;
            values.push(winningAmount);
        }
        
        queryText += ` WHERE id = $${paramIndex} RETURNING *;`;
        values.push(listingId);

        const result = await client.query(queryText, values);
        logger.info(`Listing ${listingId} status updated to '${status}' with winner/amount in DB.`);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error in updateListingStatusAndWinner(${listingId}):`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

const updateNFTOwnership = async (nftAddress, tokenId, newOwnerId) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE nfts
            SET owner_id = $1, updated_at = NOW()
            WHERE contract_address = $2 AND token_id = $3
            RETURNING *;
        `;
        const result = await client.query(query, [newOwnerId, nftAddress, tokenId]);
        logger.info(`NFT ${tokenId} ownership updated to ownerId: ${newOwnerId}.`);
        return result.rows[0];
    } finally {
        client.release();
    }
};

const getListingById = async (listingId) => {
  const client = await pool.connect();
  try {
    const queryText = `
      SELECT
          l.id, l.nft_address, l.token_id, l.seller_id, l.current_price, l.status,
          l.auction_contract_id, l.highest_bid_amount, l.highest_bidder_id, l.auction_end_time,
          l.winner_id, l.winning_amount,
          n.name AS nft_name, n.description AS nft_description, n.image_url AS nft_image_url,
          s.username AS seller_username, s.display_name AS seller_display_name, s.custodial_address AS seller_wallet_address,
          hb.username AS highest_bidder_username, hb.display_name AS highest_bidder_display_name,
          w.username AS winner_username, w.display_name AS winner_display_name
      FROM listings l
      JOIN nfts n ON l.nft_address = n.contract_address AND l.token_id = n.token_id
      JOIN users s ON l.seller_id = s.id
      LEFT JOIN users hb ON l.highest_bidder_id = hb.id
      LEFT JOIN users w ON l.winner_id = w.id
      WHERE l.id = $1;
    `;
    const result = await client.query(queryText, [listingId]);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching listing by ID ${listingId}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

async function getListingByAuctionContractId(auctionContractId) {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                l.id, l.nft_address, l.token_id, l.seller_id, l.status,
                l.auction_contract_id, l.auction_end_time, l.highest_bid_amount, l.highest_bidder_id
            FROM listings l
            WHERE l.auction_contract_id = $1;
        `;
        const result = await client.query(query, [auctionContractId]);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error in getListingByAuctionContractId(${auctionContractId}):`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

// --- Offer System Functions ---
const createOffer = async (listingId, buyerId, amount, nftAddress, tokenId, txHash) => {
  const client = await pool.connect();
  try {
    const insertQuery = `
      INSERT INTO offers (listing_id, buyer_id, amount, nft_address, token_id, transaction_hash, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      RETURNING *;
    `;
    const values = [listingId, buyerId, amount, nftAddress, tokenId, txHash];
    const res = await client.query(insertQuery, values);
    logger.info(`Offer created for listing ${listingId} by buyer ${buyerId}.`);
    return res.rows[0];
  } catch (error) {
    logger.error('Error creating offer in DB:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

const getOfferById = async (offerId) => {
  const client = await pool.connect();
  try {
    const findQuery = `
      SELECT
          o.id, o.listing_id, o.buyer_id, o.amount, o.nft_address, o.token_id, o.transaction_hash, o.status, o.created_at, o.updated_at,
          l.seller_id,
          bu.custodial_address AS buyer_wallet_address,
          su.custodial_address AS seller_wallet_address,
          l.current_price,
          l.status AS listing_status
      FROM offers o
      JOIN listings l ON o.listing_id = l.id
      JOIN users bu ON o.buyer_id = bu.id
      JOIN users su ON l.seller_id = su.id
      WHERE o.id = $1;
    `;
    const res = await client.query(findQuery, [offerId]);
    return res.rows[0];
  } catch (error) {
    logger.error(`Error finding offer by ID ${offerId}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

const updateOfferStatus = async (offerId, status, txHash = null) => {
  const client = await pool.connect();
  try {
    const updateQuery = `
      UPDATE offers
      SET status = $1,
          transaction_hash = COALESCE($2, transaction_hash),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const values = [status, txHash, offerId];
    const res = await client.query(updateQuery, values);
    logger.info(`Offer ${offerId} status updated to '${status}'.`);
    return res.rows[0];
  } catch (error) {
    logger.error(`Error updating offer status for offerId ${offerId} in DB:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

const getOffersForListing = async (listingId) => {
  const client = await pool.connect();
  try {
    const findQuery = `
      SELECT o.*, u.display_name AS buyer_display_name, u.custodial_address AS buyer_wallet_address
      FROM offers o
      JOIN users u ON o.buyer_id = u.id
      WHERE o.listing_id = $1
      ORDER BY o.amount DESC, o.created_at DESC;
    `;
    const res = await client.query(findQuery, [listingId]);
    return res.rows;
  } catch (error) {
    logger.error(`Error fetching offers for listing ${listingId}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

async function getOffers(filters = {}, pagination = { limit: 10, offset: 0 }) {
    const client = await pool.connect();
    try {
        let queryText = `
            SELECT
                o.*,
                l.status AS listing_status, l.nft_address, l.token_id, l.seller_id,
                bu.username AS buyer_username, bu.display_name AS buyer_display_name,
                su.username AS seller_username, su.display_name AS seller_display_name
            FROM offers o
            JOIN listings l ON o.listing_id = l.id
            JOIN users bu ON o.buyer_id = bu.id
            JOIN users su ON l.seller_id = su.id
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        if (filters.listing_id) { queryText += ` AND o.listing_id = $${paramIndex++}`; values.push(filters.listing_id); }
        if (filters.buyer_id) { queryText += ` AND o.buyer_id = $${paramIndex++}`; values.push(filters.buyer_id); }
        if (filters.status) { queryText += ` AND o.status = $${paramIndex++}`; values.push(filters.status); }
        if (filters.seller_id) { queryText += ` AND l.seller_id = $${paramIndex++}`; values.push(filters.seller_id); }

        const countQueryText = `SELECT COUNT(*) FROM offers o JOIN listings l ON o.listing_id = l.id JOIN users bu ON o.buyer_id = bu.id JOIN users su ON l.seller_id = su.id WHERE 1=1 ${queryText.split('WHERE 1=1')[1].split('ORDER BY')[0]}`;
        const countValues = [...values];

        queryText += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
        values.push(pagination.limit, pagination.offset);

        const [result, countResult] = await Promise.all([
            client.query(queryText, values),
            client.query(countQueryText, countValues)
        ]);
        const totalCount = parseInt(countResult.rows[0].count);
        return { data: result.rows, total: totalCount, page: pagination.offset / pagination.limit + 1, limit: pagination.limit };
    } catch (error) {
        logger.error('Error in getOffers:', error.message);
        throw error;
    } finally {
        client.release();
    }
}


// --- Bids Functions ---
async function addBid({ auction_contract_id, listing_id, bidder_id, amount, transaction_hash, bid_time, status = 'active' }) {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO bids (auction_contract_id, listing_id, bidder_id, amount, transaction_hash, bid_time, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [auction_contract_id, listing_id, bidder_id, amount, transaction_hash, bid_time, status];
        const res = await client.query(insertQuery, values);
        logger.info(`Bid added to DB for auction_contract_id ${auction_contract_id} by bidder ${bidder_id}.`);
        return res.rows[0];
    } catch (error) {
        logger.error(`Error in addBid:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function updateListingHighestBid(auctionContractId, newHighestBidAmount, newHighestBidderId) {
    const client = await pool.connect();
    try {
        const updateQuery = `
            UPDATE listings
            SET highest_bid_amount = $1,
                highest_bidder_id = $2,
                updated_at = NOW()
            WHERE auction_contract_id = $3
            RETURNING *;
        `;
        const values = [newHighestBidAmount, newHighestBidderId, auctionContractId];
        const res = await client.query(updateQuery, values);
        logger.info(`Listing with auction_contract_id ${auctionContractId} highest bid updated in DB.`);
        return res.rows[0];
    } catch (error) {
        logger.error(`Error in updateListingHighestBid:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function getBids(filters = {}, pagination = { limit: 10, offset: 0 }) {
    const client = await pool.connect();
    try {
        let queryText = `
            SELECT
                b.*,
                l.status AS listing_status, l.nft_address, l.token_id, l.seller_id, l.auction_end_time,
                bu.username AS bidder_username, bu.display_name AS bidder_display_name
            FROM bids b
            JOIN listings l ON b.listing_id = l.id
            JOIN users bu ON b.bidder_id = bu.id
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        if (filters.auction_contract_id) { queryText += ` AND b.auction_contract_id = $${paramIndex++}`; values.push(filters.auction_contract_id); }
        if (filters.bidder_id) { queryText += ` AND b.bidder_id = $${paramIndex++}`; values.push(filters.bidder_id); }
        if (filters.listing_id) { queryText += ` AND b.listing_id = $${paramIndex++}`; values.push(filters.listing_id); }
        if (filters.status) { queryText += ` AND b.status = $${paramIndex++}`; values.push(filters.status); }
        if (filters.min_amount) { queryText += ` AND b.amount >= $${paramIndex++}`; values.push(filters.min_amount); }
        if (filters.max_amount) { queryText += ` AND b.amount <= $${paramIndex++}`; values.push(filters.max_amount); }

        const countQueryText = `SELECT COUNT(*) FROM bids b JOIN listings l ON b.listing_id = l.id JOIN users bu ON b.bidder_id = bu.id WHERE 1=1 ${queryText.split('WHERE 1=1')[1].split('ORDER BY')[0]}`;
        const countValues = [...values];

        queryText += ` ORDER BY b.amount DESC, b.bid_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
        values.push(pagination.limit, pagination.offset);

        const [result, countResult] = await Promise.all([
            client.query(queryText, values),
            client.query(countQueryText, countValues)
        ]);
        const totalCount = parseInt(countResult.rows[0].count);
        return { data: result.rows, total: totalCount, page: pagination.offset / pagination.limit + 1, limit: pagination.limit };
    } catch (error) {
        logger.error('Error in getBids:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// --- Search and Filtering for Marketplace ---
async function getNFTs(filters = {}, pagination = { limit: 10, offset: 0 }) {
    const client = await pool.connect();
    try {
        let queryText = `
            SELECT n.*, u.username, u.display_name AS owner_display_name
            FROM nfts n
            JOIN users u ON n.owner_id = u.id
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        if (filters.owner_id) { queryText += ` AND n.owner_id = $${paramIndex++}`; values.push(filters.owner_id); }
        if (filters.contract_address) { queryText += ` AND n.contract_address = $${paramIndex++}`; values.push(filters.contract_address); }
        if (filters.token_id) { queryText += ` AND n.token_id = $${paramIndex++}`; values.push(filters.token_id); }
        if (filters.search_term) {
            queryText += ` AND (LOWER(n.name) LIKE $${paramIndex} OR LOWER(n.description) LIKE $${paramIndex})`;
            values.push(`%${filters.search_term.toLowerCase()}%`);
        }

        const countQueryText = `SELECT COUNT(*) FROM nfts n JOIN users u ON n.owner_id = u.id WHERE 1=1 ${queryText.split('WHERE 1=1')[1].split('ORDER BY')[0]}`;
        const countValues = [...values];

        let orderBy = 'n.created_at DESC';
        if (filters.sort_by) {
            if (filters.sort_by === 'name_asc') orderBy = 'n.name ASC';
            if (filters.sort_by === 'name_desc') orderBy = 'n.name DESC';
        }
        queryText += ` ORDER BY ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
        values.push(pagination.limit, pagination.offset);

        const [result, countResult] = await Promise.all([
            client.query(queryText, values),
            client.query(countQueryText, countValues)
        ]);
        const totalCount = parseInt(countResult.rows[0].count);
        return { data: result.rows, total: totalCount, page: pagination.offset / pagination.limit + 1, limit: pagination.limit };
    } catch (error) {
        logger.error('Error in getNFTs:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function getListings(filters = {}, pagination = { limit: 10, offset: 0 }) {
    const client = await pool.connect();
    try {
        let queryText = `
            SELECT
                l.id, l.nft_address, l.token_id, l.seller_id, l.current_price, l.status,
                l.auction_contract_id, l.highest_bid_amount, l.highest_bidder_id, l.auction_end_time,
                l.winner_id, l.winning_amount,
                n.name AS nft_name, n.description AS nft_description, n.image_url AS nft_image_url,
                s.username AS seller_username, s.display_name AS seller_display_name, s.custodial_address AS seller_wallet_address,
                hb.username AS highest_bidder_username, hb.display_name AS highest_bidder_display_name,
                w.username AS winner_username, w.display_name AS winner_display_name
            FROM listings l
            JOIN nfts n ON l.nft_address = n.contract_address AND l.token_id = n.token_id
            JOIN users s ON l.seller_id = s.id
            LEFT JOIN users hb ON l.highest_bidder_id = hb.id
            LEFT JOIN users w ON l.winner_id = w.id
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        if (filters.status) { queryText += ` AND l.status = $${paramIndex++}`; values.push(filters.status); }
        if (filters.search_term) {
            queryText += ` AND (LOWER(n.name) LIKE $${paramIndex} OR LOWER(n.description) LIKE $${paramIndex})`;
            values.push(`%${filters.search_term.toLowerCase()}%`);
        }
        
        const countQueryText = `SELECT COUNT(*) FROM listings l JOIN nfts n ON l.nft_address = n.contract_address AND l.token_id = n.token_id JOIN users s ON l.seller_id = s.id LEFT JOIN users hb ON l.highest_bidder_id = hb.id LEFT JOIN users w ON l.winner_id = w.id WHERE 1=1 ${queryText.split('WHERE 1=1')[1].split('ORDER BY')[0]}`;
        const countValues = [...values];
        
        let orderBy = 'l.created_at DESC';
        
        queryText += ` ORDER BY ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
        values.push(pagination.limit, pagination.offset);

        const [result, countResult] = await Promise.all([
            client.query(queryText, values),
            client.query(countQueryText, countValues)
        ]);
        const totalCount = parseInt(countResult.rows[0].count);
        return { data: result.rows, total: totalCount, page: pagination.offset / pagination.limit + 1, limit: pagination.limit };
    } catch (error) {
        logger.error('Error in getListings:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
  query,
  createUser,
  findUserByEmail,
  findUserByUsername,
  getUserById,
  findUserByCustodialAddress,
  getPrivateKeyByUserId,
  updateUserProfile,
  getUserProfile,
  addNFT,
  createInitialListing,
  getListingByTokenIdAndSellerId,
  getListingByNFTAndSeller,
  updateListingWithAuctionDetails,
  updateListingStatus,
  updateListingStatusAndWinner,
  updateNFTOwnership,
  getListingById,
  getListingByAuctionContractId,
  createOffer,
  getOfferById,
  updateOfferStatus,
  getOffersForListing,
  getOffers,
  addBid,
  updateListingHighestBid,
  getBids,
  getNFTs,
  getListings,
  getNftsByOwnerId,
};