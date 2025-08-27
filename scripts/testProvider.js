require('dotenv').config();
const { ethers } = require('ethers');

console.log('AMOY_RPC_URL:', process.env.AMOY_RPC_URL);

const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);

provider.getNetwork()
  .then(network => {
    console.log('Network:', network);
    process.exit(0);
  })
  .catch(error => {
    console.error('Provider Error:', error);
    process.exit(1);
  });
