// CamAppServer/index.js (with CORS middleware)
console.log("Starting index.js...");

const express = require('express');
const app = express();
const port = 5011;
const cors = require('cors'); // --- NEW: Import cors middleware ---

// Middleware to parse JSON request bodies
app.use(express.json());

// --- NEW: Enable CORS for all origins (for development) ---
// In production, you would restrict this to your frontend's domain.
app.use(cors()); 
// --- END NEW ---

// Import all route handlers
const userRoutes = require('./src/routes/user');
const nftRoutes = require('./src/routes/nft');
const streamerRoutes = require('./src/routes/streamer');

// A basic root route to confirm the server is running
app.get('/', (req, res) => {
  res.send('Hello World! Your CamAppServer is running.');
});

// Use the imported route handlers for specific API paths
app.use('/api/users', userRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/streamer', streamerRoutes);

// Start the server and listen for incoming requests
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});