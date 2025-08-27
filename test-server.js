const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Hello!'));

app.listen(9019, () => {
  console.log('✅ Test server on http://localhost:9019');
});
