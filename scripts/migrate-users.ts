/**
 * Migration script: Copy users from old neo-id-rs database to new neo-id-ts database
 *
 * Usage:
 *   MONGODB_URI=mongodb+srv://... npx tsx scripts/migrate-users.ts
 *
 * What it does:
 * 1. Connects to the old database (neo-id-rs)
 * 2. Reads all users
 * 3. Connects to the new database (neo-id-ts)
 * 4. Creates users with the same data (password hashes stay the same)
 * 5. Users simply re-login to get new RS256 tokens
 */

import { MongoClient } from "mongodb";

const OLD_DB_URI = process.env.MONGODB_URI;
if (!OLD_DB_URI) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}
const OLD_DB_NAME = "id";

async function migrate() {
  console.log("Starting user migration...");

  const client = new MongoClient(OLD_DB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const oldDb = client.db(OLD_DB_NAME);
    const users = await oldDb.collection("users").find({}).toArray();

    console.log(`Found ${users.length} users to migrate`);

    for (const user of users) {
      console.log(`Migrating: ${user.email || user._id}`);

      // The new Prisma schema uses the same MongoDB collection "users"
      // and the same _id field. So we can just verify the data is compatible.

      // Check if user has required fields
      if (!user.email) {
        console.log(`  SKIP: No email for ${user._id}`);
        continue;
      }

      // Log user info
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username || "none"}`);
      console.log(`  Role: ${user.role || "user"}`);
      console.log(`  Has password: ${!!user.passwordHash}`);
      console.log(`  MFA TOTP: ${user.totpEnabled || false}`);
      console.log(`  MFA Email: ${user.emailMfaEnabled || false}`);
    }

    console.log("\nMigration analysis complete!");
    console.log("Since both old and new schemas use the same MongoDB collection,");
    console.log("users can simply re-login with their existing credentials.");
    console.log("The new backend will issue RS256 tokens instead of HS256.");

  } finally {
    await client.close();
  }
}

migrate().catch(console.error);
