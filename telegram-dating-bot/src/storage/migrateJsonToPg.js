const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");

function readJsonFile(name) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Migration: skipping unreadable ${name}:`, err.message);
    return null;
  }
}

// One-time import of whatever the JSON files still hold into Postgres.
//
// Runs on every boot but only does anything the first time: it stops
// immediately if the database already has profiles, and every statement is an
// upsert/ON CONFLICT DO NOTHING, so a re-run can neither duplicate rows nor
// overwrite newer data. That makes it safe to leave in place permanently.
async function migrateJsonToPg(pg) {
  const existing = await pg.getAllProfiles();
  if (Object.keys(existing).length > 0) return { skipped: true, reason: "database already has profiles" };

  const profiles = readJsonFile("profiles.json");
  const likes = readJsonFile("likes.json");
  const dislikes = readJsonFile("dislikes.json");
  const unlocks = readJsonFile("unlocks.json");
  const languages = readJsonFile("languages.json");
  const admins = readJsonFile("admins.json");
  const vip = readJsonFile("vipChatAccess.json");
  const discover = readJsonFile("discoverState.json");

  if (!profiles && !likes && !languages && !admins) {
    return { skipped: true, reason: "no JSON data to import" };
  }

  const counts = { profiles: 0, likes: 0, dislikes: 0, unlocks: 0, languages: 0, admins: 0, vip: 0, discover: 0 };

  for (const [userId, p] of Object.entries(profiles || {})) {
    await pg.saveProfile(userId, p);
    // saveProfile deliberately keeps existing entitlement columns rather than
    // clearing them, so these are applied explicitly after it.
    if (p.premiumUntil) await pg.setPremiumUntil(userId, p.premiumUntil);
    if (p.anonGenderUntil) await pg.setAnonGenderFilterUntil(userId, p.anonGenderUntil);
    counts.profiles++;
  }

  // likes.json is { likedId: [likerId, ...] } -- note the direction.
  for (const [likedId, likerIds] of Object.entries(likes || {})) {
    for (const likerId of likerIds || []) {
      await pg.recordLike(likerId, likedId);
      counts.likes++;
    }
  }

  for (const [userId, ids] of Object.entries(dislikes || {})) {
    for (const candidateId of ids || []) {
      await pg.recordDislike(userId, candidateId);
      counts.dislikes++;
    }
  }

  for (const [buyerId, ids] of Object.entries(unlocks || {})) {
    for (const candidateId of ids || []) {
      await pg.grantUnlock(buyerId, candidateId);
      counts.unlocks++;
    }
  }

  for (const [userId, lang] of Object.entries(languages || {})) {
    if (typeof lang === "string") {
      await pg.setLanguage(userId, lang);
      counts.languages++;
    }
  }

  for (const userId of Object.keys(admins || {})) {
    await pg.addAdmin(userId);
    counts.admins++;
  }

  for (const userId of Object.keys(vip || {})) {
    await pg.grantVipChat(userId);
    counts.vip++;
  }

  for (const [userId, state] of Object.entries(discover || {})) {
    if (state && typeof state === "object") {
      await pg.setDiscoverState(userId, { currentId: state.currentId ?? null, shown: state.shown || [] });
      counts.discover++;
    }
  }

  return { skipped: false, counts };
}

module.exports = { migrateJsonToPg };
