const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "profiles.json");
const LANG_DB_PATH = path.join(__dirname, "..", "data", "languages.json");
const LIKES_DB_PATH = path.join(__dirname, "..", "data", "likes.json");
const ADMINS_DB_PATH = path.join(__dirname, "..", "data", "admins.json");
const UNLOCKS_DB_PATH = path.join(__dirname, "..", "data", "unlocks.json");
const DISLIKES_DB_PATH = path.join(__dirname, "..", "data", "dislikes.json");
const DISCOVER_STATE_PATH = path.join(__dirname, "..", "data", "discoverState.json");
const VIP_CHAT_PATH = path.join(__dirname, "..", "data", "vipChatAccess.json");

// Null-prototype objects, not plain {} -- every ID here (candidateId,
// targetId) can originate from callback_data or a /start deep-link payload,
// both of which a technically capable client can set to ANY string, not
// just what a button/link the bot actually sent. On a plain object, a key
// like "__proto__" hits the special exotic accessor instead of a normal
// property (on read, silently returns Object.prototype instead of the
// real "not found"; on write, changes this object's actual [[Prototype]]).
// A null-prototype object has no such accessor at all, so those keys just
// behave like any other unknown key.
// readFileSync + JSON.parse BLOCKS the event loop -- nothing else in the bot
// runs while it happens. Callers like the likes list touch these files once
// per entry, so with a few thousand profiles that added up to seconds of the
// whole bot being frozen for one person's screen.
//
// This process is the only writer, and writeJson refreshes the entry right
// after it renames, so a cache keyed on the file's mtime+size stays correct.
// Every caller here follows the same read -> mutate -> writeJson sequence
// synchronously, so handing back the cached object is safe: any mutation is
// always persisted immediately after. A caller that mutates WITHOUT writing
// would desync the cache from disk -- don't add one.
const parsedCache = new Map();

function cacheKeyFor(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return Object.create(null);

  const key = cacheKeyFor(filePath);
  const cached = parsedCache.get(filePath);
  if (key && cached && cached.key === key) return cached.data;

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`Could not read ${filePath}:`, err.message);
    return Object.create(null);
  }

  try {
    const data = Object.assign(Object.create(null), JSON.parse(raw));
    if (key) parsedCache.set(filePath, { key, data });
    return data;
  } catch (err) {
    // Silently returning {} here would be the worst possible outcome: the very
    // next write would persist that emptiness and permanently erase everyone.
    // Keep one copy of the damaged file so it can still be recovered by hand,
    // and make the problem loud instead of invisible.
    const backup = `${filePath}.corrupt`;
    try {
      if (!fs.existsSync(backup)) fs.copyFileSync(filePath, backup);
    } catch (copyErr) {
      console.error(`Could not preserve corrupt file ${filePath}:`, copyErr.message);
    }
    console.error(`CORRUPT DATA FILE: ${filePath} (copy kept at ${backup}):`, err.message);
    return Object.create(null);
  }
}

// writeFileSync truncates the target first and only then writes, so a crash
// (or a host killing the container) partway through leaves a half-written,
// unparseable file -- which readJson would then treat as "no data at all".
// Writing to a temporary file and renaming avoids that entirely: rename is
// atomic, so the real file is always either the complete old version or the
// complete new one, never something in between.
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);

  // Re-key the cache to the file we just wrote, so the very next read is a
  // hit rather than re-parsing what we already hold in memory.
  const key = cacheKeyFor(filePath);
  if (key) parsedCache.set(filePath, { key, data });
  else parsedCache.delete(filePath);
}

function getProfile(userId) {
  return readJson(DB_PATH)[String(userId)] || null;
}

function saveProfile(userId, profile) {
  const all = readJson(DB_PATH);
  all[String(userId)] = { ...profile, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[String(userId)];
}

function deleteProfile(userId) {
  const all = readJson(DB_PATH);
  delete all[String(userId)];
  writeJson(DB_PATH, all);
}

function getAllProfiles() {
  return readJson(DB_PATH);
}

function setProfileActive(userId, active) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return null;
  all[key] = { ...all[key], active, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

// Upserts rather than no-opping when there's no profile yet. A paid entitlement
// must never be silently dropped just because the buyer hasn't finished (or has
// since deleted) their anketa -- that's real money taken with nothing delivered.
// A record created this way holds only the entitlement: it has no name/photo/
// phone/gender, so discovery, the likes list and the anketa screens all skip it
// exactly as they already skip incomplete profiles, and it fills in normally
// once that person completes registration.
function setPremiumUntil(userId, untilIso) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  all[key] = { ...(all[key] || {}), premiumUntil: untilIso, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

function hasPremium(userId) {
  const profile = getProfile(userId);
  return !!profile?.premiumUntil && new Date(profile.premiumUntil) > new Date();
}

// Upserts for the same reason setPremiumUntil does -- see the note there.
function setAnonGenderFilterUntil(userId, untilIso) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  all[key] = { ...(all[key] || {}), anonGenderUntil: untilIso, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

// Active Premium includes free gender-filter access in anonymous chat (a
// separate paid perk on its own, 12,900 so'm/week) for as long as Premium
// lasts -- no separate anongender purchase needed while Premium is active.
function hasAnonGenderFilter(userId) {
  const profile = getProfile(userId);
  if (hasPremium(userId)) return true;
  return !!profile?.anonGenderUntil && new Date(profile.anonGenderUntil) > new Date();
}

function recordLike(likerId, likedId) {
  const all = readJson(LIKES_DB_PATH);
  const key = String(likedId);
  const likers = new Set(all[key] || []);
  likers.add(String(likerId));
  all[key] = [...likers];
  writeJson(LIKES_DB_PATH, all);
}

function getLikers(userId) {
  return readJson(LIKES_DB_PATH)[String(userId)] || [];
}

function hasLiked(likerId, likedId) {
  return getLikers(likedId).includes(String(likerId));
}

// Per-profile paid unlocks: { [buyerId]: [candidateId, ...] }. Once a buyer
// has paid for a candidate's contact once, they never have to pay again for
// that same candidate.
function hasUnlocked(buyerId, candidateId) {
  const all = readJson(UNLOCKS_DB_PATH);
  const list = all[String(buyerId)] || [];
  return list.includes(String(candidateId));
}

function grantUnlock(buyerId, candidateId) {
  const all = readJson(UNLOCKS_DB_PATH);
  const key = String(buyerId);
  const set = new Set(all[key] || []);
  set.add(String(candidateId));
  all[key] = [...set];
  writeJson(UNLOCKS_DB_PATH, all);
}

// Dislikes are permanent (unlike the old in-memory-only "shown this session"
// tracking) so a disliked profile never resurfaces in discovery again, even
// after the in-memory pool cycles or the process restarts.
function recordDislike(userId, candidateId) {
  const all = readJson(DISLIKES_DB_PATH);
  const key = String(userId);
  const set = new Set(all[key] || []);
  set.add(String(candidateId));
  all[key] = [...set];
  writeJson(DISLIKES_DB_PATH, all);
}

function getDislikes(userId) {
  return readJson(DISLIKES_DB_PATH)[String(userId)] || [];
}

// Which candidate is currently on screen for a user, and which candidates
// they've already been shown this pool-cycle. Persisted to disk (not just an
// in-memory Map) so a Render free-tier restart mid-session doesn't silently
// disconnect a ❤️/👎 tap from the candidate it was actually about.
function getDiscoverState(userId) {
  return readJson(DISCOVER_STATE_PATH)[String(userId)] || null;
}

function setDiscoverState(userId, state) {
  const all = readJson(DISCOVER_STATE_PATH);
  all[String(userId)] = state;
  writeJson(DISCOVER_STATE_PATH, all);
}

function clearDiscoverState(userId) {
  const all = readJson(DISCOVER_STATE_PATH);
  delete all[String(userId)];
  writeJson(DISCOVER_STATE_PATH, all);
}

// Paid VIP chat access. Kept in its own file (not on the profile) so it's
// recorded even for someone who hasn't finished registering, and so a failed
// "here's your invite link" message can never lose what was paid for -- the
// buyer just presses the VIP button again and gets the link back.
function grantVipChat(userId) {
  const all = readJson(VIP_CHAT_PATH);
  all[String(userId)] = { grantedAt: new Date().toISOString() };
  writeJson(VIP_CHAT_PATH, all);
}

function hasVipChat(userId) {
  return !!readJson(VIP_CHAT_PATH)[String(userId)];
}

function isAdmin(userId) {
  return !!readJson(ADMINS_DB_PATH)[String(userId)];
}

function addAdmin(userId) {
  const all = readJson(ADMINS_DB_PATH);
  all[String(userId)] = { addedAt: new Date().toISOString() };
  writeJson(ADMINS_DB_PATH, all);
}

function getLanguage(userId) {
  return readJson(LANG_DB_PATH)[String(userId)] || null;
}

function setLanguage(userId, lang) {
  const all = readJson(LANG_DB_PATH);
  all[String(userId)] = lang;
  writeJson(LANG_DB_PATH, all);
}

module.exports = {
  getProfile,
  saveProfile,
  deleteProfile,
  getAllProfiles,
  setProfileActive,
  setPremiumUntil,
  hasPremium,
  setAnonGenderFilterUntil,
  hasAnonGenderFilter,
  grantVipChat,
  hasVipChat,
  isAdmin,
  addAdmin,
  getLanguage,
  setLanguage,
  recordLike,
  getLikers,
  hasLiked,
  hasUnlocked,
  grantUnlock,
  recordDislike,
  getDislikes,
  getDiscoverState,
  setDiscoverState,
  clearDiscoverState,
};
