// CamAppServer/index.js

const express = require('express');
const app = express();
const port = 3000; // The port your server will listen on

// A simple test route
app.get('/', (req, res) => {
  res.send('Hello World! Your CamAppServer is running.');
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});