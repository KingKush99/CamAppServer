// scripts/addUserForExistingWallet.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { encrypt } = require('../src/utils/encryption'); // uses your existing encryption util
const { ethers } = require('ethers');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const [,, emailArg, passwordArg, addressArg, pkArg] = process.argv;

  if (!emailArg || !passwordArg || !addressArg || !pkArg) {
    console.error('Usage: node scripts/addUserForExistingWallet.js <email> <password> <address> <privateKey>');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(passwordArg, 10);
  const address = ethers.utils.getAddress(addressArg); // checksum
  const privateKey = pkArg.startsWith('0x') ? pkArg : '0x' + pkArg;
  const encPk = encrypt(privateKey);

  const username = email.split('@')[0];
  const displayName = username;

  const sql = `
    INSERT INTO users (email, password_hash, username, display_name, custodial_address, encrypted_private_key, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          custodial_address = EXCLUDED.custodial_address,
          encrypted_private_key = EXCLUDED.encrypted_private_key
    RETURNING id, email, custodial_address;
  `;

  const values = [email, passwordHash, username, displayName, address, encPk];

  const res = await pool.query(sql, values);
  console.log('Upserted user:', res.rows[0]);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
