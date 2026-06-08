#!/usr/bin/env node
/**
 * Run once from Render Shell to seed fixed users:
 *   npm run seed:user
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const USERS_TO_SEED = [
  {
    username: "jahongir",
    password: "jokkhaa",
    fullName: "Jahongir",
    role: "admin",
  },
];

async function run() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB");

  // Use the native collection to bypass mongoose index management
  const col = mongoose.connection.db.collection("users");

  for (const u of USERS_TO_SEED) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const now = new Date();

    const existing = await col.findOne({ username: u.username.toLowerCase() });

    if (existing) {
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            fullName: u.fullName,
            role: u.role,
            isSuspended: false,
            suspendedUntil: null,
            suspensionReason: null,
            updatedAt: now,
          },
        }
      );
      console.log(`Updated user: @${u.username}`);
    } else {
      await col.insertOne({
        username: u.username.toLowerCase(),
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        bio: "",
        avatar: null,
        banner: null,
        type: "student",
        isPrivateAccount: false,
        isSuspended: false,
        suspendedUntil: null,
        suspensionReason: null,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        accountId: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`Created user: @${u.username}`);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
