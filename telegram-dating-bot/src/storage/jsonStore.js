const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "profiles.json");
const LANG_DB_PATH = path.join(__dirname, "..", "..", "data", "languages.json");
const LIKES_DB_PATH = path.join(__dirname, "..", "..", "data", "likes.json");
const ADMINS_DB_PATH = path.join(__dirname, "..", "..", "data", "admins.json");
const UNLOCKS_DB_PATH = path.join(__dirname, "..", "..", "data", "unlocks.json");
const DISLIKES_DB_PATH = path.join(__dirname, "..", "..", "data", "dislikes.json");
const DISCOVER_STATE_PATH = path.join(__dirname, "..", "..", "data", "discoverState.json");
const VIP_CHAT_PATH = path.join(__dirname, "..", "..", "data", "vipChatAccess.json");
const COMPLAINTS_PATH = path.join(__dirname, "..", "..", "data", "complaints.json");

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

async function getProfile(userId) {
  return readJson(DB_PATH)[String(userId)] || null;
}

async function saveProfile(userId, profile) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  // The wizard hands over a complete draft and replaces the record, but it
  // never carries the Telegram @username (that's captured separately on any
  // interaction), so it has to be preserved explicitly or a fresh signup
  // would erase the handle recorded moments earlier.
  const keepUsername = all[key]?.username;
  all[key] = { ...profile, updatedAt: new Date().toISOString() };
  if (keepUsername && !all[key].username) all[key].username = keepUsername;
  writeJson(DB_PATH, all);
  return all[key];
}

// Upserts, because it's called on plain interactions -- someone can have a
// @username long before (or without ever) finishing an anketa, and that
// handle is what makes a working profile link possible.
// Updates only -- never creates. This runs on EVERY message from EVERY
// person, so writing a record here gave anyone who so much as tapped a button
// a profile containing nothing but a @username. Those empty records then read
// as "this person has an anketa" everywhere else: right after an admin
// deleted someone, their next tap recreated it and the bot greeted them with
// "Xush kelibsiz, undefined" instead of starting a new anketa.
//
// updatedAt is deliberately NOT touched: this is bookkeeping, not an edit,
// and bumping it on every message would make "last updated" meaningless.
async function setTelegramUsername(userId, username) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  const current = all[key];
  if (!current) return;
  if (current.username === (username || undefined)) return;
  all[key] = { ...current, username: username || undefined };
  writeJson(DB_PATH, all);
}

// Removing the profile alone left the person half-present: the likes they had
// given still sat in other people's "who liked me" counts, their dislikes
// still filtered candidates, and their discover cursor still pointed at
// someone. To an admin who had just deleted them, they were still there.
//
// Deliberately kept: complaints (the record of why they were removed, and the
// reporter is still owed a reply) and languages (so the "your account was
// deleted" message reaches them in their own language). Paid entitlements
// live on the profile itself and go with it.
function dropFromListMap(filePath, key, alsoDropFromValues) {
  const all = readJson(filePath);
  let changed = delete all[key];
  if (alsoDropFromValues) {
    for (const [owner, list] of Object.entries(all)) {
      if (!Array.isArray(list) || !list.includes(key)) continue;
      all[owner] = list.filter((entry) => entry !== key);
      changed = true;
    }
  }
  if (changed) writeJson(filePath, all);
}

async function deleteProfile(userId) {
  const key = String(userId);

  // likes.json is keyed by the person who was liked, so this person appears
  // both as a key (who liked them) and inside other people's lists.
  dropFromListMap(LIKES_DB_PATH, key, true);
  dropFromListMap(DISLIKES_DB_PATH, key, true);
  dropFromListMap(UNLOCKS_DB_PATH, key, true);

  for (const filePath of [DISCOVER_STATE_PATH, VIP_CHAT_PATH]) {
    const all = readJson(filePath);
    if (delete all[key]) writeJson(filePath, all);
  }

  const all = readJson(DB_PATH);
  delete all[key];
  writeJson(DB_PATH, all);
}

async function getAllProfiles() {
  return readJson(DB_PATH);
}

async function setProfileActive(userId, active) {
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
async function setPremiumUntil(userId, untilIso) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  all[key] = { ...(all[key] || {}), premiumUntil: untilIso, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

async function hasPremium(userId) {
  const profile = await getProfile(userId);
  return !!profile?.premiumUntil && new Date(profile.premiumUntil) > new Date();
}

// Upserts for the same reason setPremiumUntil does -- see the note there.
async function setAnonGenderFilterUntil(userId, untilIso) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  all[key] = { ...(all[key] || {}), anonGenderUntil: untilIso, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

// Active Premium includes free gender-filter access in anonymous chat (a
// separate paid perk on its own, 12,900 so'm/week) for as long as Premium
// lasts -- no separate anongender purchase needed while Premium is active.
async function hasAnonGenderFilter(userId) {
  const profile = await getProfile(userId);
  if (await hasPremium(userId)) return true;
  return !!profile?.anonGenderUntil && new Date(profile.anonGenderUntil) > new Date();
}

async function recordLike(likerId, likedId) {
  const all = readJson(LIKES_DB_PATH);
  const key = String(likedId);
  const likers = new Set(all[key] || []);
  likers.add(String(likerId));
  all[key] = [...likers];
  writeJson(LIKES_DB_PATH, all);
}

async function getLikers(userId) {
  return readJson(LIKES_DB_PATH)[String(userId)] || [];
}

async function hasLiked(likerId, likedId) {
  return (await getLikers(likedId)).includes(String(likerId));
}

// Per-profile paid unlocks: { [buyerId]: [candidateId, ...] }. Once a buyer
// has paid for a candidate's contact once, they never have to pay again for
// that same candidate.
async function hasUnlocked(buyerId, candidateId) {
  const all = readJson(UNLOCKS_DB_PATH);
  const list = all[String(buyerId)] || [];
  return list.includes(String(candidateId));
}

async function grantUnlock(buyerId, candidateId) {
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
async function recordDislike(userId, candidateId) {
  const all = readJson(DISLIKES_DB_PATH);
  const key = String(userId);
  const set = new Set(all[key] || []);
  set.add(String(candidateId));
  all[key] = [...set];
  writeJson(DISLIKES_DB_PATH, all);
}

async function getDislikes(userId) {
  return readJson(DISLIKES_DB_PATH)[String(userId)] || [];
}

// Which candidate is currently on screen for a user, and which candidates
// they've already been shown this pool-cycle. Persisted to disk (not just an
// in-memory Map) so a Render free-tier restart mid-session doesn't silently
// disconnect a ❤️/👎 tap from the candidate it was actually about.
async function getDiscoverState(userId) {
  return readJson(DISCOVER_STATE_PATH)[String(userId)] || null;
}

async function setDiscoverState(userId, state) {
  const all = readJson(DISCOVER_STATE_PATH);
  all[String(userId)] = state;
  writeJson(DISCOVER_STATE_PATH, all);
}

async function clearDiscoverState(userId) {
  const all = readJson(DISCOVER_STATE_PATH);
  delete all[String(userId)];
  writeJson(DISCOVER_STATE_PATH, all);
}

// Paid VIP chat access. Kept in its own file (not on the profile) so it's
// recorded even for someone who hasn't finished registering, and so a failed
// "here's your invite link" message can never lose what was paid for -- the
// buyer just presses the VIP button again and gets the link back.
async function grantVipChat(userId) {
  const all = readJson(VIP_CHAT_PATH);
  all[String(userId)] = { grantedAt: new Date().toISOString() };
  writeJson(VIP_CHAT_PATH, all);
}

async function hasVipChat(userId) {
  return !!readJson(VIP_CHAT_PATH)[String(userId)];
}

// --- Complaints ------------------------------------------------------------
// Keyed by the short code the reporter is told, so the code they quote back is
// literally the lookup key.

// Returns false when the id is already taken, so the caller can pick another
// short code instead of silently overwriting somebody else's complaint.
async function createComplaint(id, complaint) {
  const all = readJson(COMPLAINTS_PATH);
  if (all[String(id)]) return false;
  all[String(id)] = {
    id: String(id),
    reporterId: String(complaint.reporterId),
    targetId: complaint.targetId ? String(complaint.targetId) : null,
    source: complaint.source,
    text: complaint.text,
    status: "open",
    adminReply: null,
    createdAt: new Date().toISOString(),
    answeredAt: null,
  };
  writeJson(COMPLAINTS_PATH, all);
  return true;
}

async function getComplaint(id) {
  return readJson(COMPLAINTS_PATH)[String(id)] || null;
}

// Unanswered ones first so the admin always lands on work that still needs
// doing, then oldest-first within each group.
async function listComplaints() {
  return Object.values(readJson(COMPLAINTS_PATH)).sort((a, b) => {
    const aDone = a.status === "answered" ? 1 : 0;
    const bDone = b.status === "answered" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

async function setComplaintReply(id, reply) {
  const all = readJson(COMPLAINTS_PATH);
  const row = all[String(id)];
  if (!row) return null;
  row.adminReply = reply;
  row.status = "answered";
  row.answeredAt = new Date().toISOString();
  writeJson(COMPLAINTS_PATH, all);
  return { ...row };
}

async function isAdmin(userId) {
  return !!readJson(ADMINS_DB_PATH)[String(userId)];
}

async function addAdmin(userId) {
  const all = readJson(ADMINS_DB_PATH);
  all[String(userId)] = { addedAt: new Date().toISOString() };
  writeJson(ADMINS_DB_PATH, all);
}

// The PIN grants admin access permanently with no way to undo it -- if it is
// ever typed by the wrong person (shown over someone's shoulder, guessed,
// leaked with a screenshot), that person stayed an admin forever. These two
// are what make revocation possible from inside the panel itself, without
// needing shell access to the host.
async function listAdmins() {
  return Object.keys(readJson(ADMINS_DB_PATH));
}

async function removeAdmin(userId) {
  const all = readJson(ADMINS_DB_PATH);
  const key = String(userId);
  if (!(key in all)) return false;
  delete all[key];
  writeJson(ADMINS_DB_PATH, all);
  return true;
}

async function getLanguage(userId) {
  return readJson(LANG_DB_PATH)[String(userId)] || null;
}

async function setLanguage(userId, lang) {
  const all = readJson(LANG_DB_PATH);
  all[String(userId)] = lang;
  writeJson(LANG_DB_PATH, all);
}

module.exports = {
  getProfile,
  saveProfile,
  setTelegramUsername,
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
  listAdmins,
  removeAdmin,
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
  createComplaint,
  getComplaint,
  listComplaints,
  setComplaintReply,
};
