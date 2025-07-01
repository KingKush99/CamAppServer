// CamAppServer/index.js

const express = require('express');
const app = express();
const port = 3000;

// Import routes (this is the ONLY place userRoutes should be required at this level)
const userRoutes = require('./src/routes/user'); 

// Middleware to parse JSON request bodies
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
  res.send('Hello World! Your CamAppServer is running.');
});

// Use user-related authentication and profile routes
app.use('/api/users', userRoutes); 

// Start the server
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});