// index.js

const express = require('express');
const app = express();
const port = 3000; // The port your server will listen on

// Import routes
const userRoutes = require('./src/routes/user'); // Our user routes

// Middleware to parse JSON request bodies
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
  res.send('Hello World! Your CamAppServer is running.');
});

// Use user-related authentication and profile routes
// All routes in userRoutes will be prefixed with /api/users
app.use('/api/users', userRoutes); 

// Start the server
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});