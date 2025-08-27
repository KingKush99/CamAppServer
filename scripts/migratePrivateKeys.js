// CamAppServer/scripts/migratePrivateKeys.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // Ensure .env is loaded from root
const { encrypt } = require('../src/utils/encryption'); // Correct path from scripts/ to src/utils/

// --- FIX START ---
// Assume your database connection and User model are setup and exported from src/services/db.js
// If your db.js sets up Mongoose and exports models, this is common:
const db = require('../src/services/db'); // This line should trigger your DB connection if db.js does that automatically
// Assuming your User model is accessible via db.User, like:
const User = db.User; // Adjust if your User model is exported differently from db.js
// --- FIX END ---


async function migratePrivateKeys() {
    try {
        // If your db.js explicitly requires a function call to connect (e.g., db.connect()), call it here:
        // await db.connect(); // Uncomment if needed

        // This query finds users where encrypted_private_key exists and does NOT contain ':'
        // The ':' is part of our new encryption format (iv:encryptedData:authTag),
        // so this targets keys that are likely still in plain text or old format.
        const usersToMigrate = await User.find({
            encrypted_private_key: { $exists: true, $not: /:/ }
        });

        if (usersToMigrate.length === 0) {
            return;
        }

        for (const user of usersToMigrate) {
            const plainTextKey = user.encrypted_private_key;
            const encrypted = encrypt(plainTextKey);
            user.encrypted_private_key = encrypted;
            await user.save();
            console.log(`Migrated private key for user: ${user.username}`); // Be careful not to log sensitive info
        }
    } catch (error) {
        console.error('Error during private key migration:', error);
    } finally {
        // If your db.js provides a close function (e.g., db.close()), call it here:
        // db.close(); // Uncomment if needed
        process.exit(0); // Exit the script after completion
    }
}

// Execute the migration function
migratePrivateKeys();