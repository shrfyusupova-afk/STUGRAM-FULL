#!/usr/bin/env node
/**
 * Run once from Render Shell to seed a fixed user:
 *   node src/scripts/seedUser.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

// Minimal inline schema — avoids loading the full app stack.
const userSchema = new mongoose.Schema({
  identity: { type: String, sparse: true, lowercase: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  bio: { type: String, default: "" },
  avatar: { type: String, default: null },
  role: { type: String, default: "user" },
  type: { type: String, default: "student" },
  isPrivateAccount: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  postsCount: { type: Number, default: 0 },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

const USERS_TO_SEED = [
  {
    username: "jahongir",
    password: "jokkhaa",
    fullName: "Jahongir",
    identity: null, // no email needed — login by username
    role: "admin",
  },
];

async function run() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB");

  for (const u of USERS_TO_SEED) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const existing = await User.findOne({ username: u.username });

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.isSuspended = false;
      existing.role = u.role;
      if (u.fullName) existing.fullName = u.fullName;
      await existing.save();
      console.log(`Updated user: @${u.username}`);
    } else {
      await User.create({
        username: u.username,
        fullName: u.fullName,
        identity: u.identity || undefined,
        passwordHash,
        role: u.role,
        bio: "",
        isPrivateAccount: false,
        isSuspended: false,
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
