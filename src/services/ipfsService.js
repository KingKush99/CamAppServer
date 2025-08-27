// src/services/ipfsService.js (Final Version using node-fetch and direct API Keys)

// const axios = require('axios'); // Remove axios
const fetch = require('node-fetch'); // --- NEW: Import node-fetch ---
const config = require('../../config');

/**
 * Uploads a JSON object to Pinata (IPFS).
 * This uses Pinata's API Key and Secret for authentication with node-fetch.
 * @param {object} jsonData - The JSON object to upload (e.g., { name: "My NFT", description: "..." }).
 * @returns {string} The IPFS CID (hash) of the uploaded JSON.
 */
const uploadJsonToIpfs = async (jsonData) => {
  console.log('Uploading JSON to Pinata...');
  
  // --- Authentication with direct API Key and Secret in headers ---
  // Pinata's specific headers for API Key/Secret (different from standard Basic Auth)
  const headers = {
    'Content-Type': 'application/json',
    'pinata_api_key': config.pinataApiKey,       // Pinata's specific header for API Key
    'pinata_secret_api_key': config.pinataApiSecret // Pinata's specific header for API Secret
  };
  // --- END Authentication ---

  // --- DIAGNOSTIC LOGS ---
  // --- END DIAGNOSTIC LOGS ---

  try {
    const response = await fetch( // Use fetch instead of axios.post
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST', // Specify HTTP method
        headers: headers, // Use the custom Pinata headers
        body: JSON.stringify(jsonData) // Stringify the JSON data for the body
      }
    );

    const responseData = await response.json(); 

    if (!response.ok) { 
        console.error('Pinata API Error Response (HTTP Status):', response.status);
        console.error('Pinata API Error Response (Body):', responseData);
        throw new Error(responseData.error?.details || responseData.error?.reason || response.statusText);
    }

    console.log('Successfully uploaded to Pinata. CID:', responseData.IpfsHash);
    return responseData.IpfsHash;

  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw new Error('Failed to upload metadata to IPFS.');
  }
};

module.exports = {
  uploadJsonToIpfs
};