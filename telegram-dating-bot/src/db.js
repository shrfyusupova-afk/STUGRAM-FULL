const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "profiles.json");
const LANG_DB_PATH = path.join(__dirname, "..", "data", "languages.json");
const LIKES_DB_PATH = path.join(__dirname, "..", "data", "likes.json");
const ADMINS_DB_PATH = path.join(__dirname, "..", "data", "admins.json");
const UNLOCKS_DB_PATH = path.join(__dirname, "..", "data", "unlocks.json");
const DISLIKES_DB_PATH = path.join(__dirname, "..", "data", "dislikes.json");
const DISCOVER_STATE_PATH = path.join(__dirname, "..", "data", "discoverState.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

function setPremiumUntil(userId, untilIso) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return null;
  all[key] = { ...all[key], premiumUntil: untilIso, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

function hasPremium(userId) {
  const profile = getProfile(userId);
  return !!profile?.premiumUntil && new Date(profile.premiumUntil) > new Date();
}

function setAnonGenderFilterUntil(userId, untilIso) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return null;
  all[key] = { ...all[key], anonGenderUntil: untilIso, updatedAt: new Date().toISOString() };
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
