
'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./src/utils/logger');
const config = require('./config');

const app = express();
const PORT = config.port || 9020;

// --- Middleware Setup ---
// Enable Cross-Origin Resource Sharing (CORS) to allow requests from your frontend
app.use(cors({
  origin: config.frontendUrl, // Use the frontend URL from your config/env file
  credentials: true,
}));

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Simple request logger middleware to show incoming requests in the console
app.use((req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});


// --- Route Mounting ---
// All routes related to users will be prefixed with /api/users
logger.info('Loading user routes...');
const userRoutes = require('./src/routes/user');
app.use('/api/users', userRoutes);
logger.info('Loaded user routes successfully.');

// All routes related to NFTs, listings, and auctions will be prefixed with /api/nfts
logger.info('Loading nft routes...');
const nftRoutes = require('./src/routes/nft');
app.use('/api/nfts', nftRoutes);
logger.info('Loaded nft routes successfully.');


// --- Root Endpoint for Health Check ---
// A simple GET request to the root URL will confirm the server is running
app.get('/', (req, res) => {
  res.status(200).send('Nova Cam Backend API is running!');
});


// --- Start Server ---
// This block contains the logic to start the Express server and listen for requests
try {
  logger.info('Starting server...');
  app.listen(PORT, () => {
    logger.info(`✅ Server started successfully on http://localhost:${PORT}`);
  }).on('error', (err) => {
    // This '.on('error')' listener is crucial for catching startup errors
    // like the EADDRINUSE error you saw before.
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
} catch (error) {
  logger.error('An unexpected error occurred during server startup:', error);
  process.exit(1);
}