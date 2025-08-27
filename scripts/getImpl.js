// scripts/getImpl.js
require('dotenv').config();
const { ethers } = require('ethers');

const RPC = process.env.AMOY_RPC_URL;          // your Amoy/Polygon RPC
const proxy = process.argv[2];                 // proxy address passed on CLI

// EIP-1967 slots
const SLOT_IMPL  = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';
const SLOT_ADMIN = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const SLOT_BEACON= '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';

const provider = new ethers.providers.JsonRpcProvider(RPC);

const toChecksum = (slotVal) => {
  if (!slotVal || slotVal === '0x') return null;
  const addr = '0x' + slotVal.slice(-40);
  return ethers.utils.getAddress(addr);
};

(async () => {
  if (!RPC || !proxy) {
    console.error('Usage: AMOY_RPC_URL=<rpc> node scripts/getImpl.js <proxyAddress>');
    process.exit(1);
  }

  const implRaw   = await provider.getStorageAt(proxy, SLOT_IMPL);
  const adminRaw  = await provider.getStorageAt(proxy, SLOT_ADMIN);
  const beaconRaw = await provider.getStorageAt(proxy, SLOT_BEACON);

  const impl   = toChecksum(implRaw);
  const admin  = toChecksum(adminRaw);
  const beacon = toChecksum(beaconRaw);

  console.log('Impl slot  :', implRaw,   '=>', impl   || '(empty)');
  
  // If it's a Beacon proxy, also read the beacon's implementation()
  if (beacon) {
    const beaconAbi = ['function implementation() view returns (address)'];
    const beaconCtr = new ethers.Contract(beacon, beaconAbi, provider);
    const beaconImpl = await beaconCtr.implementation();
  }
})().catch(console.error);
