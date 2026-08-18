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
const REFERRALS_PATH = path.join(__dirname, "..", "..", "data", "referrals.json");
const PAYME_PATH = path.join(__dirname, "..", "..", "data", "paymeTransactions.json");

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

// Same interface as pgStore's SQL-backed versions, so adminBot.js doesn't
// need to know which backend it's talking to. The JSON backend has no query
// engine to push this into, so it stays an in-memory scan -- documented
// elsewhere as a JSON-only limitation; only Postgres is meant to carry real
// scale.
function isRegisteredEntry(p) { return !!p?.name; }

async function searchProfiles(rawQuery, limit) {
  const needle = rawQuery.toLowerCase().replace(/^@/, "");
  const needleDigits = needle.replace(/\D/g, "");
  const phoneEligible = /\d{4}/.test(needle);
  const all = readJson(DB_PATH);
  const hits = [];
  for (const [id, p] of Object.entries(all)) {
    const matches =
      id === rawQuery ||
      (p.name && p.name.toLowerCase().includes(needle)) ||
      (p.username && p.username.toLowerCase().includes(needle)) ||
      (phoneEligible && p.phone && p.phone.replace(/\D/g, "").includes(needleDigits));
    if (matches) hits.push([id, p]);
    if (hits.length >= limit) break;
  }
  return hits;
}

async function getProfileStats() {
  const all = Object.values(readJson(DB_PATH));
  const registered = all.filter(isRegisteredEntry);
  return {
    total: registered.length,
    male: registered.filter((p) => p.gender === "male").length,
    female: registered.filter((p) => p.gender === "female").length,
    active: registered.filter((p) => p.active !== false).length,
    pendingAnketa: all.length - registered.length,
    premiumNow: all.filter((p) => p.premiumUntil && new Date(p.premiumUntil) > new Date()).length,
  };
}

// Every id in the table -- same universe Object.keys(await getAllProfiles())
// used to reach, including a payment record with no finished anketa.
async function listAllProfileIds() {
  return Object.keys(readJson(DB_PATH));
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

// likes.json is keyed by WHO WAS LIKED (each value is the list of likers), so
// "who did this person like" has no direct key -- has to scan every entry.
// Fine for the JSON fallback (local dev / small deploys only); the Postgres
// path answers the same question with an indexed query instead.
async function getMyLikes(userId) {
  const all = readJson(LIKES_DB_PATH);
  const key = String(userId);
  const mine = [];
  for (const [likedId, likers] of Object.entries(all)) {
    if (likers.includes(key)) mine.push(likedId);
  }
  return mine;
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


// The highest "N people liked you" milestone already announced to this
// person. Same purpose as the Postgres column of the same name.
async function getLikeNoticeAt(userId) {
  return readJson(DB_PATH)[String(userId)]?.likeNoticeAt || 0;
}

async function setLikeNoticeAt(userId, value) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return;
  all[key] = { ...all[key], likeNoticeAt: value };
  writeJson(DB_PATH, all);
}


// See the Postgres version: pairs that matched before the contact stopped
// being granted to both sides keep what they already had.
async function backfillMatchUnlocks() {
  const likes = readJson(LIKES_DB_PATH);
  const unlocks = readJson(UNLOCKS_DB_PATH);
  let granted = 0;
  // likes is keyed by the LIKED person, holding the list of who liked them.
  for (const [likedId, likers] of Object.entries(likes)) {
    for (const likerId of likers || []) {
      const mutual = (likes[likerId] || []).includes(String(likedId));
      if (!mutual) continue;
      const set = new Set(unlocks[likerId] || []);
      if (set.has(String(likedId))) continue;
      set.add(String(likedId));
      unlocks[likerId] = [...set];
      granted++;
    }
  }
  if (granted) writeJson(UNLOCKS_DB_PATH, unlocks);
  return granted;
}



// Same answer as the Postgres version, computed from the files this backend
// already holds in memory -- no per-liker round trips here either.
async function countPendingLikers(userId) {
  const key = String(userId);
  const likes = readJson(LIKES_DB_PATH);
  const profiles = readJson(DB_PATH);
  const myLikes = new Set(likes[key] === undefined ? [] : []);
  // likes is keyed by the LIKED person, so "who have I liked" means scanning
  // for lists that contain me.
  for (const [likedId, likers] of Object.entries(likes)) {
    if ((likers || []).includes(key)) myLikes.add(String(likedId));
  }
  let n = 0;
  for (const likerId of likes[key] || []) {
    if (myLikes.has(String(likerId))) continue;
    const p = profiles[String(likerId)];
    if (!p?.mediaFileId || p.active === false) continue;
    n++;
  }
  return n;
}

// --- win-back ----------------------------------------------------------------
// Same behaviour as the Postgres version; see there for why each field exists.

async function touchLastSeen(userId) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return;
  all[key] = { ...all[key], lastSeenAt: new Date().toISOString(), winbackStage: 0, botBlocked: false };
  writeJson(DB_PATH, all);
}

async function listWinbackTargets(stage, beforeIso, limit) {
  const all = readJson(DB_PATH);
  const out = [];
  for (const [userId, p] of Object.entries(all)) {
    if (!p?.name) continue;
    if (p.active === false) continue;
    if (p.notificationsEnabled === false) continue;
    if (p.botBlocked) continue;
    if ((p.winbackStage || 0) >= stage) continue;
    // See the Postgres version: a missing lastSeenAt falls back to updatedAt
    // rather than counting as infinitely idle, which would have put a signup
    // from this afternoon into the day-3 batch.
    const idleSince = p.lastSeenAt || p.updatedAt;
    if (idleSince && idleSince >= beforeIso) continue;
    out.push({ userId, gender: p.gender, name: p.name, idleSince: idleSince || "" });
  }
  // Oldest (and never-seen) first, matching the SQL ordering.
  out.sort((a, b) => String(a.idleSince).localeCompare(String(b.idleSince)));
  return out.slice(0, limit).map(({ userId, gender, name }) => ({ userId, gender, name }));
}

function patchProfile(userId, patch) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return;
  all[key] = { ...all[key], ...patch };
  writeJson(DB_PATH, all);
}

async function markWinbackSent(userId, stage) {
  patchProfile(userId, { winbackStage: stage });
}

async function markBotBlocked(userId) {
  patchProfile(userId, { botBlocked: true });
}

async function setNotificationsEnabled(userId, enabled) {
  patchProfile(userId, { notificationsEnabled: !!enabled });
}

async function getNotificationsEnabled(userId) {
  const p = readJson(DB_PATH)[String(userId)];
  return p ? p.notificationsEnabled !== false : true;
}

async function countNewProfilesSince(gender, sinceIso) {
  const all = readJson(DB_PATH);
  let n = 0;
  for (const p of Object.values(all)) {
    if (p?.gender !== gender) continue;
    if (p.active === false || !p.mediaFileId || !p.phone) continue;
    if (!p.updatedAt || p.updatedAt < sinceIso) continue;
    n++;
  }
  return n;
}

// Same population as countNewProfilesSince, listed rather than counted. See
// the Postgres version for why it is ordered oldest-first and capped.
async function listNewProfilesSince(gender, sinceIso, limit = 200) {
  const all = readJson(DB_PATH);
  const out = [];
  for (const [id, p] of Object.entries(all)) {
    if (p?.gender !== gender) continue;
    if (p.active === false || !p.mediaFileId || !p.phone) continue;
    if (!p.updatedAt || p.updatedAt < sinceIso) continue;
    out.push({ id, profile: p });
  }
  out.sort((a, b) => String(a.profile.updatedAt).localeCompare(String(b.profile.updatedAt)));
  return out.slice(0, limit);
}

// --- premium expiry reminders ------------------------------------------------
// Same behaviour as the Postgres version; see there for why the window has a
// lower bound as well as an upper one.
const DAY_MS_JSON = 24 * 60 * 60 * 1000;

async function listPremiumExpiring(limit = 200) {
  const all = readJson(DB_PATH);
  const now = Date.now();
  const out = [];
  for (const [id, p] of Object.entries(all)) {
    if (!p?.premiumUntil) continue;
    if (p.active === false || p.botBlocked || p.notificationsEnabled === false) continue;
    const until = new Date(p.premiumUntil).getTime();
    if (!Number.isFinite(until)) continue;
    if (until > now + 7 * DAY_MS_JSON) continue;
    if (until < now - 2 * DAY_MS_JSON) continue;
    out.push({ userId: id, premiumUntil: p.premiumUntil, noticeAt: p.premiumNoticeAt ?? null });
  }
  out.sort((a, b) => String(a.premiumUntil).localeCompare(String(b.premiumUntil)));
  return out.slice(0, limit);
}

async function setPremiumNoticeAt(userId, value) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return;
  all[key] = { ...all[key], premiumNoticeAt: value };
  writeJson(DB_PATH, all);
}

async function clearRenewedPremiumNotices() {
  const all = readJson(DB_PATH);
  const now = Date.now();
  let cleared = 0;
  for (const [id, p] of Object.entries(all)) {
    if (p?.premiumNoticeAt === undefined || p?.premiumNoticeAt === null) continue;
    if (!p.premiumUntil) continue;
    if (new Date(p.premiumUntil).getTime() > now + 7 * DAY_MS_JSON) {
      all[id] = { ...p, premiumNoticeAt: null };
      cleared++;
    }
  }
  if (cleared) writeJson(DB_PATH, all);
  return cleared;
}

// --- referrals ---------------------------------------------------------------
//
// Keyed by the INVITED person, matching the Postgres primary key: someone can
// be invited exactly once ever. These rows deliberately survive deleteProfile,
// which is what stops "delete the account, rejoin through the same link,
// collect the reward again".

async function createReferral(referrerId, referredId) {
  const all = readJson(REFERRALS_PATH);
  const key = String(referredId);
  if (all[key]) return false;
  all[key] = { referrerId: String(referrerId), createdAt: new Date().toISOString(), rewarded: false };
  writeJson(REFERRALS_PATH, all);
  return true;
}

async function getReferral(referredId) {
  const entry = readJson(REFERRALS_PATH)[String(referredId)];
  if (!entry) return null;
  return { ...entry, referredId: String(referredId) };
}

// Returns true only for the call that actually flips the flag, so a retry
// cannot pay a second reward for the same invitee.
async function markReferralRewarded(referredId) {
  const all = readJson(REFERRALS_PATH);
  const key = String(referredId);
  if (!all[key] || all[key].rewarded) return false;
  all[key] = { ...all[key], rewarded: true, rewardedAt: new Date().toISOString() };
  writeJson(REFERRALS_PATH, all);
  return true;
}

async function countReferrals(referrerId, { rewardedOnly = false, sinceIso = null } = {}) {
  const all = readJson(REFERRALS_PATH);
  const wanted = String(referrerId);
  let n = 0;
  for (const entry of Object.values(all)) {
    if (entry.referrerId !== wanted) continue;
    if (rewardedOnly && !entry.rewarded) continue;
    if (sinceIso && !(entry.createdAt >= sinceIso)) continue;
    n++;
  }
  return n;
}

// Who brought the most people in. Counts only invitees who FINISHED their
// anketa (`rewarded`), because a click on a link is not a user. Somebody
// whose invitees all abandoned the form has brought in nobody and does not
// appear here at all.
async function topReferrers(limit = 10) {
  const tally = new Map();
  for (const entry of Object.values(readJson(REFERRALS_PATH))) {
    if (!entry.rewarded) continue;
    const row = tally.get(entry.referrerId) || { referrerId: entry.referrerId, rewarded: 0 };
    row.rewarded++;
    tally.set(entry.referrerId, row);
  }
  return [...tally.values()]
    .sort((a, b) => b.rewarded - a.rewarded || String(a.referrerId).localeCompare(String(b.referrerId)))
    .slice(0, limit);
}

// --- unlock credits ----------------------------------------------------------

async function getUnlockCredits(userId) {
  const profile = readJson(DB_PATH)[String(userId)];
  return profile?.unlockCredits || 0;
}

async function addUnlockCredits(userId, amount) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return 0;
  const next = (all[key].unlockCredits || 0) + amount;
  all[key] = { ...all[key], unlockCredits: next };
  writeJson(DB_PATH, all);
  return next;
}

// Refuses to go below zero rather than trusting the caller to have checked --
// the Postgres version enforces the same thing in its WHERE clause, and the
// two backends must not disagree about whether an empty balance can be spent.
async function consumeUnlockCredit(userId) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  const have = all[key]?.unlockCredits || 0;
  if (have <= 0) return false;
  all[key] = { ...all[key], unlockCredits: have - 1 };
  writeJson(DB_PATH, all);
  return true;
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

// --- payme transactions ------------------------------------------------------
//
// Payme's own state machine, keyed by ITS transaction id. Mirrors the
// Postgres table exactly so nothing above this layer can tell them apart.

async function getPaymeTransaction(paymeId) {
  return readJson(PAYME_PATH)[String(paymeId)] || null;
}

async function getPaymeTransactionByOrder(merchantTransId) {
  const all = Object.values(readJson(PAYME_PATH)).filter(
    (tx) => tx.merchantTransId === String(merchantTransId)
  );
  if (all.length === 0) return null;
  return all.sort((a, b) => Number(b.createTime) - Number(a.createTime))[0];
}

async function createPaymeTransaction({ paymeId, merchantTransId, amountTiyin, state, createTime }) {
  const all = readJson(PAYME_PATH);
  const key = String(paymeId);
  // Matches the Postgres ON CONFLICT DO NOTHING: a retried CreateTransaction
  // must not overwrite the record it is retrying.
  if (all[key]) return;
  all[key] = {
    paymeId: key,
    merchantTransId: String(merchantTransId),
    amountTiyin,
    state,
    reason: null,
    createTime,
    performTime: 0,
    cancelTime: 0,
  };
  writeJson(PAYME_PATH, all);
}

async function setPaymeTransactionState(paymeId, state, { performTime, cancelTime, reason } = {}) {
  const all = readJson(PAYME_PATH);
  const key = String(paymeId);
  if (!all[key]) return;
  all[key].state = state;
  if (performTime !== undefined && performTime !== null) all[key].performTime = performTime;
  if (cancelTime !== undefined && cancelTime !== null) all[key].cancelTime = cancelTime;
  if (reason !== undefined && reason !== null) all[key].reason = reason;
  writeJson(PAYME_PATH, all);
}

async function listPaymeTransactions(from, to) {
  return Object.values(readJson(PAYME_PATH))
    .filter((tx) => Number(tx.createTime) >= from && Number(tx.createTime) <= to)
    .sort((a, b) => Number(a.createTime) - Number(b.createTime));
}

module.exports = {
  getPaymeTransaction,
  getPaymeTransactionByOrder,
  createPaymeTransaction,
  setPaymeTransactionState,
  listPaymeTransactions,
  getProfile,
  saveProfile,
  setTelegramUsername,
  deleteProfile,
  getAllProfiles,
  searchProfiles,
  getProfileStats,
  listAllProfileIds,
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
  getMyLikes,
  hasUnlocked,
  grantUnlock,
  createReferral,
  getReferral,
  markReferralRewarded,
  countReferrals,
  topReferrers,
  getUnlockCredits,
  addUnlockCredits,
  consumeUnlockCredit,
  getLikeNoticeAt,
  setLikeNoticeAt,
  countPendingLikers,
  backfillMatchUnlocks,
  touchLastSeen,
  listWinbackTargets,
  markWinbackSent,
  markBotBlocked,
  setNotificationsEnabled,
  getNotificationsEnabled,
  countNewProfilesSince,
  listNewProfilesSince,
  listPremiumExpiring,
  setPremiumNoticeAt,
  clearRenewedPremiumNotices,
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
