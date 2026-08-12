const { Pool } = require("pg");

// Postgres-backed storage. Same function names and return shapes as
// jsonStore, so nothing outside this folder needs to know which one is live.
//
// Every user id is stored as text: Telegram ids exceed 2^31 and, more
// importantly, the rest of the codebase compares them as strings already.
let pool = null;
let sslDisabled = false;

// Whether to attempt TLS for this connection string.
//
// The two URLs a managed host hands out differ here: the public/external one
// goes over the internet and needs TLS, while the private/internal one stays
// inside the provider's network and may not offer TLS at all. Guessing wrong
// in either direction is a hard connection failure, so this only picks a
// starting point -- init() falls back if the server disagrees.
function sslOptionFor(connectionString) {
  if (sslDisabled) return false;
  if (/[?&]sslmode=disable/.test(connectionString)) return false;
  // Local development runs plain TCP.
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)) return false;
  // Managed Postgres terminates TLS with a certificate the container's trust
  // store doesn't recognise. The connection is still encrypted; verification
  // is what's relaxed, not the encryption.
  return { rejectUnauthorized: false };
}

function buildPool() {
  const connectionString = process.env.DATABASE_URL;
  const p = new Pool({ connectionString, ssl: sslOptionFor(connectionString), max: 5 });
  // A pool-level error (server restart, idle connection dropped) is emitted on
  // the pool itself; without a listener it would be an unhandled 'error' event
  // and take the process down.
  p.on("error", (err) => console.error("Postgres pool error:", err.message));
  return p;
}

function getPool() {
  if (!pool) pool = buildPool();
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

// Confirms the connection actually works before any schema work, and retries
// once without TLS if the server turns out not to speak it. That's what makes
// either URL a managed host offers usable without the operator having to know
// which one needs SSL -- the common "internal vs external URL" trip-up.
async function connectWithSslFallback() {
  try {
    await getPool().query("SELECT 1");
  } catch (err) {
    const noSsl = /does not support SSL|server does not support SSL connections/i.test(err.message || "");
    if (!noSsl || sslDisabled) throw err;
    console.warn("Postgres refused a TLS connection -- retrying without it (internal network URL).");
    sslDisabled = true;
    try {
      await pool.end();
    } catch {
      /* the pool never connected; nothing to close */
    }
    pool = buildPool();
    await getPool().query("SELECT 1");
  }
}

// Called once at startup. CREATE TABLE IF NOT EXISTS makes this safe to run on
// every boot, which doubles as the migration path for a fresh database.
async function init() {
  await connectWithSslFallback();
  await query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id           TEXT PRIMARY KEY,
      name              TEXT,
      age               INTEGER,
      gender            TEXT,
      gender_label      TEXT,
      location          TEXT,
      bio               TEXT,
      phone             TEXT,
      media_file_id     TEXT,
      media_type        TEXT,
      active            BOOLEAN NOT NULL DEFAULT TRUE,
      premium_until     TIMESTAMPTZ,
      anon_gender_until TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS likes (
      liker_id TEXT NOT NULL,
      liked_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (liker_id, liked_id)
    )`);
  await query(`CREATE INDEX IF NOT EXISTS likes_liked_idx ON likes (liked_id)`);
  // Every swipe runs pickCandidateRow, which is by far the hottest query in
  // the app. The partial index keeps it to the showable profiles of one
  // gender instead of a scan over the whole table.
  await query(
    `CREATE INDEX IF NOT EXISTS profiles_discover_idx ON profiles (gender)
       WHERE active = TRUE AND media_file_id IS NOT NULL AND phone IS NOT NULL`
  );
  await query(`
    CREATE TABLE IF NOT EXISTS dislikes (
      user_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      PRIMARY KEY (user_id, candidate_id)
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS unlocks (
      buyer_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (buyer_id, candidate_id)
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS languages (
      user_id TEXT PRIMARY KEY,
      lang TEXT NOT NULL
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      user_id TEXT PRIMARY KEY,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS vip_chat_access (
      user_id TEXT PRIMARY KEY,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS discover_state (
      user_id TEXT PRIMARY KEY,
      current_id TEXT,
      shown JSONB NOT NULL DEFAULT '[]'::jsonb
    )`);
  // id is the short code shown to the person who filed it, so they can quote
  // it back later -- it's the primary key rather than a surrogate precisely
  // so the code they were told is the one that identifies the row.
  await query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id           TEXT PRIMARY KEY,
      reporter_id  TEXT NOT NULL,
      target_id    TEXT,
      source       TEXT NOT NULL,
      text         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'open',
      admin_reply  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at  TIMESTAMPTZ
    )`);
  await query(`CREATE INDEX IF NOT EXISTS complaints_created_idx ON complaints (created_at)`);
  // Added after the table already existed in production, so it goes on as its
  // own statement rather than into CREATE TABLE above.
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT`);
  await query(`
    CREATE TABLE IF NOT EXISTS click_transactions (
      merchant_trans_id TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL,
      type      TEXT NOT NULL,
      target_id TEXT,
      amount    BIGINT NOT NULL,
      status    TEXT NOT NULL,
      click_trans_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at    TIMESTAMPTZ
    )`);
  // Payment and delivery are separate facts. Money can be taken (status
  // 'paid') while granting the feature fails -- a database blip, Telegram
  // being down -- and without recording that difference the purchase is
  // silently lost, because Click never asks again.
  await query(`ALTER TABLE click_transactions ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE click_transactions ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0`);
  await query(
    `CREATE INDEX IF NOT EXISTS click_undelivered_idx
       ON click_transactions (status, delivered) WHERE status = 'paid' AND delivered = FALSE`
  );
  // The order ledger is shared by every payment provider now, so it records
  // which checkout the person was sent to. The table keeps its original name
  // rather than being renamed under a live deployment holding real orders.
  await query(`ALTER TABLE click_transactions ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'click'`);

  // Payme tracks a transaction lifecycle of its own, by ITS id, separate from
  // our order: created(1) -> performed(2), or cancelled(-1/-2). Kept in its
  // own table because it is Payme's state machine, not ours -- the order row
  // stays the single provider-neutral answer to "what was bought".
  await query(`
    CREATE TABLE IF NOT EXISTS payme_transactions (
      payme_id          TEXT PRIMARY KEY,
      merchant_trans_id TEXT NOT NULL,
      amount_tiyin      BIGINT NOT NULL,
      state             INTEGER NOT NULL,
      reason            INTEGER,
      create_time       BIGINT NOT NULL,
      perform_time      BIGINT NOT NULL DEFAULT 0,
      cancel_time       BIGINT NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  // "Is there already a live transaction on this order?" runs on every
  // CreateTransaction, and GetStatement scans by time.
  await query(`CREATE INDEX IF NOT EXISTS payme_order_idx ON payme_transactions (merchant_trans_id)`);
  await query(`CREATE INDEX IF NOT EXISTS payme_time_idx ON payme_transactions (create_time)`);

  // Who invited whom. referred_id is the PRIMARY KEY, not a surrogate: a
  // person can be invited exactly once, ever, and making that a key constraint
  // means the database refuses a second row rather than the application
  // having to remember to check. That is also what stops the obvious abuse --
  // delete the account, rejoin through the same link, collect again -- because
  // this row deliberately SURVIVES deleteProfile.
  await query(`
    CREATE TABLE IF NOT EXISTS referrals (
      referred_id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rewarded    BOOLEAN NOT NULL DEFAULT FALSE,
      rewarded_at TIMESTAMPTZ
    )`);
  // Both lookups this table gets are "everything one referrer brought in",
  // either in total or within the last 24 hours for the daily cap.
  await query(`CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id, created_at)`);

  // Free profile views, earned by inviting people. An INTEGER on the profile
  // rather than a ledger table: the only questions ever asked are "how many
  // are left" and "take one", and both are a single row update. DEFAULT 0
  // matters -- every profile that already exists must start with none rather
  // than NULL, or every arithmetic on it would silently produce NULL.
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlock_credits INTEGER NOT NULL DEFAULT 0`);

  // The highest "N people liked you" milestone this person has already been
  // told about. Without it the bot either pings on every single like -- which
  // is what people mute a bot for -- or has to re-derive "have I said this
  // yet" from data that does not record it.
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS like_notice_at INTEGER NOT NULL DEFAULT 0`);

  // Win-back campaign state.
  //
  // last_seen_at is the only way to know somebody has drifted: updated_at
  // moves only when the anketa is saved, so a person who browses daily and
  // never edits looks identical to one who left months ago.
  //
  // winback_stage records how far the campaign has got with this person (0 =
  // nothing sent, 3 = the day-3 message, 7 = the day-7 one). It is reset the
  // moment they come back, so the sequence starts over next time rather than
  // being spent forever.
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS winback_stage INTEGER NOT NULL DEFAULT 0`);
  // DEFAULT TRUE matters: everyone who already exists has not opted out.
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
  // Telegram answers 403 for "bot was blocked by the user". That is not an
  // error, it is a fact worth recording -- writing to them again is wasted
  // quota forever.
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_blocked BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(
    `CREATE INDEX IF NOT EXISTS profiles_winback_idx ON profiles (last_seen_at)
       WHERE active = TRUE AND notifications_enabled = TRUE AND bot_blocked = FALSE`
  );
}

// Rows come back with snake_case columns and Date objects; the rest of the
// app expects the original JSON shape (camelCase, ISO strings, absent keys
// rather than nulls), so every read goes through this.
function rowToProfile(row) {
  if (!row) return null;
  const p = {};
  if (row.name !== null) p.name = row.name;
  if (row.username) p.username = row.username;
  if (row.age !== null) p.age = row.age;
  if (row.gender !== null) p.gender = row.gender;
  if (row.gender_label !== null) p.genderLabel = row.gender_label;
  if (row.location !== null) p.location = row.location;
  if (row.bio !== null) p.bio = row.bio;
  if (row.phone !== null) p.phone = row.phone;
  if (row.media_file_id !== null) p.mediaFileId = row.media_file_id;
  if (row.media_type !== null) p.mediaType = row.media_type;
  p.active = row.active;
  if (row.premium_until) p.premiumUntil = row.premium_until.toISOString();
  if (row.anon_gender_until) p.anonGenderUntil = row.anon_gender_until.toISOString();
  if (row.updated_at) p.updatedAt = row.updated_at.toISOString();
  return p;
}

async function getProfile(userId) {
  const { rows } = await query(`SELECT * FROM profiles WHERE user_id = $1`, [String(userId)]);
  return rowToProfile(rows[0]);
}

async function getAllProfiles() {
  const { rows } = await query(`SELECT * FROM profiles`);
  const out = Object.create(null);
  for (const row of rows) out[row.user_id] = rowToProfile(row);
  return out;
}

// The admin search used to run getAllProfiles() -- pulling every row for
// every name/id/phone search -- and grew with the whole table, not with the
// search: at 1,000,000 profiles that is ~1GB of parsed rows and tens of
// seconds, for someone looking up ONE person. This does the same matching
// (id / name / @username / phone digits) as a filtered, LIMITed query, so a
// search costs roughly the same at 1,000,000 rows as it does at 1,000.
//
// phoneDigits mirrors what matchesQuery required client-side: the phone
// branch only applies when the query itself looks like a phone number (at
// least 4 digits), otherwise a short numeric query would match almost every
// stored number by coincidence.
async function searchProfiles(rawQuery, limit) {
  const needle = rawQuery.toLowerCase().replace(/^@/, "");
  const phoneDigits = needle.replace(/\D/g, "");
  const phoneEligible = /\d{4}/.test(needle);

  const { rows } = await query(
    `SELECT * FROM profiles
      WHERE user_id = $1
         OR lower(name) LIKE '%' || $2 || '%'
         OR lower(username) LIKE '%' || $2 || '%'
         OR ($3 AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE '%' || $4 || '%')
      LIMIT $5`,
    [rawQuery, needle, phoneEligible, phoneDigits, limit]
  );
  return rows.map((row) => [row.user_id, rowToProfile(row)]);
}

// One aggregate query instead of pulling every row to count/filter/sum in
// Node -- the admin stats screen used to be exactly the same "whole table
// into memory" cost as the search above, just for a handful of numbers.
async function getProfileStats() {
  const { rows } = await query(`
    SELECT
      count(*) FILTER (WHERE name IS NOT NULL) AS total,
      count(*) FILTER (WHERE name IS NOT NULL AND gender = 'male') AS male,
      count(*) FILTER (WHERE name IS NOT NULL AND gender = 'female') AS female,
      count(*) FILTER (WHERE name IS NOT NULL AND active) AS active,
      count(*) FILTER (WHERE name IS NULL) AS pending_anketa,
      count(*) FILTER (WHERE premium_until > NOW()) AS premium_now
    FROM profiles
  `);
  const r = rows[0];
  return {
    total: Number(r.total), male: Number(r.male), female: Number(r.female),
    active: Number(r.active), pendingAnketa: Number(r.pending_anketa), premiumNow: Number(r.premium_now),
  };
}

// Broadcast targets: every id in the table, same universe
// Object.keys(await getAllProfiles()) used to reach -- including a payment
// record with no finished anketa, a real Telegram account that is still
// reachable, just not "registered" yet. Only the ids, not the full rows: a
// 1,000,000-row broadcast used to build its recipient list by loading every
// profile; a plain array of ids is a few MB at that scale instead of the
// ~1GB a full getAllProfiles() would be, for the one thing a broadcast needs.
async function listAllProfileIds() {
  const { rows } = await query(`SELECT user_id FROM profiles`);
  return rows.map((row) => row.user_id);
}

// Mirrors jsonStore.saveProfile: the wizard hands over a complete draft and it
// replaces the profile fields wholesale, while columns the wizard never sets
// (premium_until, anon_gender_until) are preserved.
async function saveProfile(userId, profile) {
  const { rows } = await query(
    `INSERT INTO profiles
       (user_id, name, age, gender, gender_label, location, bio, phone,
        media_file_id, media_type, active, premium_until, anon_gender_until, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, TRUE),$12,$13, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, age = EXCLUDED.age, gender = EXCLUDED.gender,
       gender_label = EXCLUDED.gender_label, location = EXCLUDED.location,
       bio = EXCLUDED.bio, phone = EXCLUDED.phone,
       media_file_id = EXCLUDED.media_file_id, media_type = EXCLUDED.media_type,
       active = EXCLUDED.active,
       premium_until = COALESCE(EXCLUDED.premium_until, profiles.premium_until),
       anon_gender_until = COALESCE(EXCLUDED.anon_gender_until, profiles.anon_gender_until),
       updated_at = NOW()
     RETURNING *`,
    [
      String(userId), profile.name ?? null, profile.age ?? null, profile.gender ?? null,
      profile.genderLabel ?? null, profile.location ?? null, profile.bio ?? null,
      profile.phone ?? null, profile.mediaFileId ?? null, profile.mediaType ?? null,
      profile.active === undefined ? null : profile.active,
      profile.premiumUntil ?? null, profile.anonGenderUntil ?? null,
    ]
  );
  return rowToProfile(rows[0]);
}

// Picks one showable candidate without reading the whole table.
//
// The previous approach loaded EVERY profile into memory on every single
// swipe, which is fine at a few hundred users and unusable at scale. This
// does the filtering (right gender, has a photo and phone, active, not
// already disliked, not already shown) in SQL and returns a single row.
//
// The premium weighting is deliberately the SAME distribution the in-memory
// version produces (a premium profile gets `premiumWeight` tickets in the
// draw instead of one), not merely "premium first":
//   power(random(), 1/w) DESC
// is weighted random sampling -- the chance of being picked is exactly
// proportional to w. The obvious `random() * w DESC` is NOT: with a handful
// of premium profiles it makes a non-premium pick almost impossible, so the
// same few people would be shown to everyone forever.
const CANDIDATE_FILTER = `
        p.gender = $2
    AND p.user_id <> $1
    AND p.media_file_id IS NOT NULL AND p.media_file_id <> ''
    AND p.phone IS NOT NULL AND p.phone <> ''
    AND p.active = TRUE
    AND NOT EXISTS (SELECT 1 FROM dislikes d WHERE d.user_id = $1 AND d.candidate_id = p.user_id)
    -- A liker/dislike is a terminal, one-time reaction to a card: once either
    -- is given, that candidate must never come back, in the recycled branch
    -- below included -- CANDIDATE_FILTER is shared by both queries, so this
    -- one line covers it everywhere. Before this, only dislikes were
    -- permanent; a liked profile was excluded ONLY via the ephemeral "shown"
    -- list, which the recycled branch deliberately discards once the pool
    -- runs dry -- so on a small candidate pool, someone you had already
    -- liked would reappear within a swipe or two of running out.
    AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.liker_id = $1 AND l.liked_id = p.user_id)`;

const PREMIUM_ORDER = (weightParam) =>
  `ORDER BY power(random(), 1.0 / (CASE WHEN p.premium_until > NOW() THEN ${weightParam}::float ELSE 1 END)) DESC`;

async function pickCandidateRow(userId, wantedGender, shownIds, premiumWeight) {
  const { rows } = await query(
    `SELECT p.* FROM profiles p
      WHERE ${CANDIDATE_FILTER}
        AND NOT (p.user_id = ANY($3::text[]))
      ${PREMIUM_ORDER("$4")}
      LIMIT 1`,
    [String(userId), wantedGender, shownIds, premiumWeight]
  );
  if (rows[0]) return { id: rows[0].user_id, profile: rowToProfile(rows[0]) };

  // Everyone available has been seen this cycle -- start over, ignoring the
  // shown list but still respecting dislikes.
  const { rows: recycled } = await query(
    `SELECT p.* FROM profiles p
      WHERE ${CANDIDATE_FILTER}
      ${PREMIUM_ORDER("$3")}
      LIMIT 1`,
    [String(userId), wantedGender, premiumWeight]
  );
  if (!recycled[0]) return null;
  return { id: recycled[0].user_id, profile: rowToProfile(recycled[0]), recycled: true };
}

// Upserts, because it's called on plain interactions -- someone can have a
// @username long before (or without ever) finishing an anketa, and that
// handle is what makes a working profile link possible.
// Updates only -- never inserts. This runs on EVERY message from EVERY
// person, so upserting here created a profiles row for anyone who so much as
// tapped a button, with nothing in it but a @username. Those empty rows then
// read as "this person has an anketa" everywhere else: right after an admin
// deleted someone, their next tap recreated the row and the bot greeted them
// with "Xush kelibsiz, undefined" instead of starting a new anketa.
//
// A username is worth recording about someone who has an anketa; it is not
// worth inventing a record for someone who does not. saveProfile keeps any
// username already captured, and the next message after registering fills it
// in for everyone else.
//
// updated_at is deliberately NOT touched: this is bookkeeping, not an edit,
// and bumping it on every message would make "last updated" meaningless.
async function setTelegramUsername(userId, username) {
  await query(`UPDATE profiles SET username = $2 WHERE user_id = $1`, [
    String(userId),
    username || null,
  ]);
}

// Removing the profiles row alone left the person half-present: the likes
// they had given still sat in other people's "who liked me" counts, their
// dislikes still filtered candidates, and their discover cursor still pointed
// at someone. To an admin who had just deleted them, they were still there.
//
// Deliberately kept: complaints (the record of why they were removed, and the
// reporter is still owed a reply) and languages (so the "your account was
// deleted" message reaches them in their own language). Paid entitlements
// live on the profiles row and go with it.
async function deleteProfile(userId) {
  const id = String(userId);
  await query(`DELETE FROM likes WHERE liker_id = $1 OR liked_id = $1`, [id]);
  await query(`DELETE FROM dislikes WHERE user_id = $1 OR candidate_id = $1`, [id]);
  await query(`DELETE FROM unlocks WHERE buyer_id = $1 OR candidate_id = $1`, [id]);
  await query(`DELETE FROM vip_chat_access WHERE user_id = $1`, [id]);
  await query(`DELETE FROM discover_state WHERE user_id = $1`, [id]);
  await query(`DELETE FROM profiles WHERE user_id = $1`, [id]);
}

async function setProfileActive(userId, active) {
  const { rows } = await query(
    `UPDATE profiles SET active = $2, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
    [String(userId), active]
  );
  return rowToProfile(rows[0]) || null;
}

// Upserts, like jsonStore does: a paid entitlement must land even if the buyer
// has no anketa yet, otherwise money is taken and nothing is delivered.
async function setPremiumUntil(userId, untilIso) {
  const { rows } = await query(
    `INSERT INTO profiles (user_id, premium_until, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET premium_until = EXCLUDED.premium_until, updated_at = NOW()
     RETURNING *`,
    [String(userId), untilIso]
  );
  return rowToProfile(rows[0]);
}

async function hasPremium(userId) {
  const { rows } = await query(
    `SELECT 1 FROM profiles WHERE user_id = $1 AND premium_until > NOW()`,
    [String(userId)]
  );
  return rows.length > 0;
}

async function setAnonGenderFilterUntil(userId, untilIso) {
  const { rows } = await query(
    `INSERT INTO profiles (user_id, anon_gender_until, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET anon_gender_until = EXCLUDED.anon_gender_until, updated_at = NOW()
     RETURNING *`,
    [String(userId), untilIso]
  );
  return rowToProfile(rows[0]);
}

// Active Premium includes the gender filter for free, same rule as jsonStore.
async function hasAnonGenderFilter(userId) {
  const { rows } = await query(
    `SELECT 1 FROM profiles
      WHERE user_id = $1 AND (premium_until > NOW() OR anon_gender_until > NOW())`,
    [String(userId)]
  );
  return rows.length > 0;
}

async function recordLike(likerId, likedId) {
  await query(
    `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [String(likerId), String(likedId)]
  );
}

async function getLikers(userId) {
  const { rows } = await query(
    `SELECT liker_id FROM likes WHERE liked_id = $1 ORDER BY created_at`,
    [String(userId)]
  );
  return rows.map((r) => r.liker_id);
}

async function hasLiked(likerId, likedId) {
  const { rows } = await query(
    `SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = $2`,
    [String(likerId), String(likedId)]
  );
  return rows.length > 0;
}

// Not used by pickCandidateRow itself (the exclusion is baked into
// CANDIDATE_FILTER above) -- exposed only so jsonStore's equivalent has a
// matching counterpart, same as every other function pair in this file.
async function getMyLikes(userId) {
  const { rows } = await query(`SELECT liked_id FROM likes WHERE liker_id = $1`, [String(userId)]);
  return rows.map((r) => r.liked_id);
}

async function hasUnlocked(buyerId, candidateId) {
  const { rows } = await query(
    `SELECT 1 FROM unlocks WHERE buyer_id = $1 AND candidate_id = $2`,
    [String(buyerId), String(candidateId)]
  );
  return rows.length > 0;
}

async function grantUnlock(buyerId, candidateId) {
  await query(
    `INSERT INTO unlocks (buyer_id, candidate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [String(buyerId), String(candidateId)]
  );
}


async function getLikeNoticeAt(userId) {
  const { rows } = await query(`SELECT like_notice_at FROM profiles WHERE user_id = $1`, [String(userId)]);
  return rows.length ? rows[0].like_notice_at || 0 : 0;
}

async function setLikeNoticeAt(userId, value) {
  await query(`UPDATE profiles SET like_notice_at = $2 WHERE user_id = $1`, [String(userId), value]);
}


// One-off repair for pairs that matched BEFORE the contact stopped being
// granted to both sides. Those two people already had each other's number;
// taking it away retroactively would be the app removing something a person
// was given, which is worse than the inconsistency it tidies up.
//
// A single indexed self-join, and ON CONFLICT makes it a no-op on every run
// after the first, so it is safe to call at every boot. Delete it once every
// deployment has started at least once past this change.
async function backfillMatchUnlocks() {
  const { rowCount } = await query(`
    INSERT INTO unlocks (buyer_id, candidate_id)
    SELECT a.liker_id, a.liked_id
      FROM likes a
      JOIN likes b ON b.liker_id = a.liked_id AND b.liked_id = a.liker_id
    ON CONFLICT DO NOTHING`);
  return rowCount;
}



// How many people have liked this person and are still waiting for an answer.
//
// This used to be done in the application: one query for the likers, then TWO
// more per liker. A profile with 500 admirers cost 1001 queries against a
// five-connection pool, and it is called on every like received, on every
// Mini App open, and once per person in a win-back sweep -- so a single sweep
// could fire tens of thousands of queries and stall every real user behind
// them. It is one indexed query.
//
// The filter matches what the likes list actually shows, so the number and the
// list underneath it agree.
async function countPendingLikers(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n
       FROM likes l
       JOIN profiles p ON p.user_id = l.liker_id
      WHERE l.liked_id = $1
        AND p.active = TRUE
        AND p.media_file_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM likes b WHERE b.liker_id = $1 AND b.liked_id = l.liker_id
        )`,
    [String(userId)]
  );
  return rows[0].n;
}

// --- win-back ----------------------------------------------------------------

// Coming back resets the campaign, and clears bot_blocked: somebody who just
// sent an update plainly has not blocked us, whatever a stale 403 once said.
async function touchLastSeen(userId) {
  await query(
    `UPDATE profiles SET last_seen_at = NOW(), winback_stage = 0, bot_blocked = FALSE WHERE user_id = $1`,
    [String(userId)]
  );
}

// Who is due the message for this stage. `stage` doubles as the marker, so
// "winback_stage < $stage" is both "hasn't had this one" and "hasn't had a
// later one" in a single condition.
//
// last_seen_at IS NULL covers profiles created before the column existed --
// they are treated as idle, which is almost certainly true.
async function listWinbackTargets(stage, beforeIso, limit) {
  const { rows } = await query(
    `SELECT user_id, gender, name
       FROM profiles
      WHERE active = TRUE
        AND notifications_enabled = TRUE
        AND bot_blocked = FALSE
        AND name IS NOT NULL
        AND winback_stage < $1
        -- COALESCE, not "IS NULL OR": last_seen_at is null for anyone who
        -- registered before the column existed AND for anyone who signed up
        -- and left, because the middleware that writes it cannot run before
        -- the profile row exists. Treating null as "infinitely idle" put a
        -- brand-new signup into the day-3 batch the same afternoon. Falling
        -- back to updated_at is both safe and true: a profile saved four days
        -- ago and untouched since really has been idle four days.
        AND COALESCE(last_seen_at, updated_at) < $2
      ORDER BY COALESCE(last_seen_at, updated_at)
      LIMIT $3`,
    [stage, beforeIso, limit]
  );
  return rows.map((r) => ({ userId: r.user_id, gender: r.gender, name: r.name }));
}

async function markWinbackSent(userId, stage) {
  await query(`UPDATE profiles SET winback_stage = $2 WHERE user_id = $1`, [String(userId), stage]);
}

async function markBotBlocked(userId) {
  await query(`UPDATE profiles SET bot_blocked = TRUE WHERE user_id = $1`, [String(userId)]);
}

async function setNotificationsEnabled(userId, enabled) {
  await query(`UPDATE profiles SET notifications_enabled = $2 WHERE user_id = $1`, [String(userId), !!enabled]);
}

async function getNotificationsEnabled(userId) {
  const { rows } = await query(`SELECT notifications_enabled FROM profiles WHERE user_id = $1`, [String(userId)]);
  return rows.length ? rows[0].notifications_enabled !== false : true;
}

// The number in the message is real. "New people joined!" with nothing behind
// it is the fastest way to teach somebody that these messages are noise.
async function countNewProfilesSince(gender, sinceIso) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM profiles
      WHERE gender = $1 AND active = TRUE
        AND media_file_id IS NOT NULL AND phone IS NOT NULL
        AND updated_at >= $2`,
    [gender, sinceIso]
  );
  return rows[0].n;
}

// --- referrals ---------------------------------------------------------------

// Returns true only if this is the FIRST time this person has been recorded as
// invited by anyone. ON CONFLICT DO NOTHING plus the row count is what makes
// that a single atomic question -- a SELECT followed by an INSERT would let
// two updates arriving together both decide they were first.
async function createReferral(referrerId, referredId) {
  const { rowCount } = await query(
    `INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)
       ON CONFLICT (referred_id) DO NOTHING`,
    [String(referrerId), String(referredId)]
  );
  return rowCount > 0;
}

async function getReferral(referredId) {
  const { rows } = await query(
    `SELECT referrer_id, referred_id, created_at, rewarded FROM referrals WHERE referred_id = $1`,
    [String(referredId)]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    referrerId: r.referrer_id,
    referredId: r.referred_id,
    createdAt: r.created_at,
    rewarded: r.rewarded,
  };
}

// Flips rewarded exactly once. The `AND rewarded = FALSE` is the whole point:
// the caller can be invoked twice for the same person (a retry, a duplicate
// update) and only one of those calls will see a row, so only one reward is
// ever paid out for one invitee.
async function markReferralRewarded(referredId) {
  const { rowCount } = await query(
    `UPDATE referrals SET rewarded = TRUE, rewarded_at = NOW()
       WHERE referred_id = $1 AND rewarded = FALSE`,
    [String(referredId)]
  );
  return rowCount > 0;
}

// sinceIso limits the count to a window -- used for the daily cap, so one
// person cannot register a hundred throwaway accounts in an afternoon.
async function countReferrals(referrerId, { rewardedOnly = false, sinceIso = null } = {}) {
  const conditions = ["referrer_id = $1"];
  const params = [String(referrerId)];
  if (rewardedOnly) conditions.push("rewarded = TRUE");
  if (sinceIso) {
    params.push(sinceIso);
    conditions.push(`created_at >= $${params.length}`);
  }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM referrals WHERE ${conditions.join(" AND ")}`,
    params
  );
  return rows[0].n;
}

// --- unlock credits ----------------------------------------------------------

async function getUnlockCredits(userId) {
  const { rows } = await query(`SELECT unlock_credits FROM profiles WHERE user_id = $1`, [String(userId)]);
  return rows.length ? rows[0].unlock_credits || 0 : 0;
}

async function addUnlockCredits(userId, amount) {
  const { rows } = await query(
    `UPDATE profiles SET unlock_credits = unlock_credits + $2 WHERE user_id = $1 RETURNING unlock_credits`,
    [String(userId), amount]
  );
  return rows.length ? rows[0].unlock_credits : 0;
}

// Take one credit, but only if there is one. The check and the decrement are
// the SAME statement on purpose: reading the balance and then writing it back
// would let two taps on the same button both pass the check and both spend,
// handing out two profiles for one credit. Returns false when there was
// nothing to spend, so the caller can fall back to the paywall.
async function consumeUnlockCredit(userId) {
  const { rowCount } = await query(
    `UPDATE profiles SET unlock_credits = unlock_credits - 1
       WHERE user_id = $1 AND unlock_credits > 0`,
    [String(userId)]
  );
  return rowCount > 0;
}

async function recordDislike(userId, candidateId) {
  await query(
    `INSERT INTO dislikes (user_id, candidate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [String(userId), String(candidateId)]
  );
}

async function getDislikes(userId) {
  const { rows } = await query(`SELECT candidate_id FROM dislikes WHERE user_id = $1`, [String(userId)]);
  return rows.map((r) => r.candidate_id);
}

async function getDiscoverState(userId) {
  const { rows } = await query(`SELECT current_id, shown FROM discover_state WHERE user_id = $1`, [String(userId)]);
  if (!rows[0]) return null;
  return { currentId: rows[0].current_id, shown: rows[0].shown || [] };
}

async function setDiscoverState(userId, state) {
  await query(
    `INSERT INTO discover_state (user_id, current_id, shown) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET current_id = EXCLUDED.current_id, shown = EXCLUDED.shown`,
    [String(userId), state.currentId ?? null, JSON.stringify(state.shown || [])]
  );
}

async function clearDiscoverState(userId) {
  await query(`DELETE FROM discover_state WHERE user_id = $1`, [String(userId)]);
}

async function grantVipChat(userId) {
  await query(
    `INSERT INTO vip_chat_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [String(userId)]
  );
}

async function hasVipChat(userId) {
  const { rows } = await query(`SELECT 1 FROM vip_chat_access WHERE user_id = $1`, [String(userId)]);
  return rows.length > 0;
}

async function isAdmin(userId) {
  const { rows } = await query(`SELECT 1 FROM admins WHERE user_id = $1`, [String(userId)]);
  return rows.length > 0;
}

async function addAdmin(userId) {
  await query(`INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [String(userId)]);
}

// The PIN grants admin access permanently with no way to undo it -- if it is
// ever typed by the wrong person (shown over someone's shoulder, guessed,
// leaked with a screenshot), that person stayed an admin forever. These two
// are what make revocation possible from inside the panel itself, without
// needing shell access to the host.
async function listAdmins() {
  const { rows } = await query(`SELECT user_id FROM admins`);
  return rows.map((r) => r.user_id);
}

async function removeAdmin(userId) {
  const { rowCount } = await query(`DELETE FROM admins WHERE user_id = $1`, [String(userId)]);
  return rowCount > 0;
}

async function getLanguage(userId) {
  const { rows } = await query(`SELECT lang FROM languages WHERE user_id = $1`, [String(userId)]);
  return rows[0] ? rows[0].lang : null;
}

async function setLanguage(userId, lang) {
  await query(
    `INSERT INTO languages (user_id, lang) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET lang = EXCLUDED.lang`,
    [String(userId), lang]
  );
}

// --- Complaints ------------------------------------------------------------

function rowToComplaint(row) {
  if (!row) return null;
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetId: row.target_id,
    source: row.source,
    text: row.text,
    status: row.status,
    adminReply: row.admin_reply,
    createdAt: row.created_at ? row.created_at.toISOString() : undefined,
    answeredAt: row.answered_at ? row.answered_at.toISOString() : undefined,
  };
}

// Returns false when the id is already taken, so the caller can pick another
// short code instead of silently overwriting somebody else's complaint.
async function createComplaint(id, complaint) {
  const { rows } = await query(
    `INSERT INTO complaints (id, reporter_id, target_id, source, text)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [id, String(complaint.reporterId), complaint.targetId ? String(complaint.targetId) : null, complaint.source, complaint.text]
  );
  return rows.length > 0;
}

async function getComplaint(id) {
  const { rows } = await query(`SELECT * FROM complaints WHERE id = $1`, [String(id)]);
  return rowToComplaint(rows[0]);
}

// Unanswered ones first so the admin always lands on work that still needs
// doing, then oldest-first within each group.
async function listComplaints() {
  const { rows } = await query(
    `SELECT * FROM complaints
      ORDER BY (status = 'answered'), created_at`
  );
  return rows.map(rowToComplaint);
}

async function setComplaintReply(id, reply) {
  const { rows } = await query(
    `UPDATE complaints
        SET admin_reply = $2, status = 'answered', answered_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [String(id), reply]
  );
  return rowToComplaint(rows[0]);
}

// --- Click transaction ledger (used by click.js when Postgres is active) ---

function rowToTx(row) {
  if (!row) return null;
  const tx = {
    userId: row.user_id,
    type: row.type,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at ? row.created_at.toISOString() : undefined,
  };
  if (row.target_id !== null) tx.targetId = row.target_id;
  if (row.click_trans_id !== null) tx.clickTransId = row.click_trans_id;
  if (row.paid_at) tx.paidAt = row.paid_at.toISOString();
  return tx;
}

async function getTransaction(merchantTransId) {
  const { rows } = await query(`SELECT * FROM click_transactions WHERE merchant_trans_id = $1`, [merchantTransId]);
  return rowToTx(rows[0]);
}

async function findPendingOrder(userId, type, targetId) {
  const { rows } = await query(
    `SELECT * FROM click_transactions
      WHERE status = 'pending' AND user_id = $1 AND type = $2
        AND ($3::text IS NULL OR target_id = $3)
      ORDER BY created_at LIMIT 1`,
    [String(userId), type, type === "unlock" ? String(targetId) : null]
  );
  if (!rows[0]) return null;
  return { merchantTransId: rows[0].merchant_trans_id, ...rowToTx(rows[0]) };
}

async function createTransaction(merchantTransId, tx) {
  await query(
    `INSERT INTO click_transactions (merchant_trans_id, user_id, type, target_id, amount, status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [merchantTransId, String(tx.userId), tx.type, tx.targetId ?? null, tx.amount, tx.status]
  );
}

async function updateTransactionAmount(merchantTransId, amount) {
  await query(`UPDATE click_transactions SET amount = $2 WHERE merchant_trans_id = $1`, [merchantTransId, amount]);
}

// Returns the row only if it actually moved to the new status, so a duplicate
// Complete from Click can never deliver a paid feature twice: the second call
// matches zero rows because the status has already changed.
async function markTransaction(merchantTransId, fromStatus, toStatus, extra = {}) {
  const { rows } = await query(
    `UPDATE click_transactions
        SET status = $3,
            click_trans_id = COALESCE($4, click_trans_id),
            paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END
      WHERE merchant_trans_id = $1 AND status = $2
      RETURNING *`,
    [merchantTransId, fromStatus, toStatus, extra.clickTransId ?? null]
  );
  return rowToTx(rows[0]);
}

// Paid purchases whose feature never actually reached the buyer. Ordered
// oldest-first so the longest-suffering customer is served first, and capped
// so one bad run can't monopolise a retry sweep.
async function listUndeliveredOrders(limit = 50) {
  const { rows } = await query(
    `SELECT * FROM click_transactions
      WHERE status = 'paid' AND delivered = FALSE
      ORDER BY paid_at NULLS FIRST, created_at
      LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ merchantTransId: r.merchant_trans_id, ...rowToTx(r), deliveryAttempts: r.delivery_attempts }));
}

async function markDelivered(merchantTransId) {
  await query(`UPDATE click_transactions SET delivered = TRUE WHERE merchant_trans_id = $1`, [merchantTransId]);
}

async function bumpDeliveryAttempts(merchantTransId) {
  const { rows } = await query(
    `UPDATE click_transactions SET delivery_attempts = delivery_attempts + 1
      WHERE merchant_trans_id = $1 RETURNING delivery_attempts`,
    [merchantTransId]
  );
  return rows[0] ? rows[0].delivery_attempts : 0;
}

async function getSalesRows(sinceIso) {
  const { rows } = await query(
    `SELECT type, amount FROM click_transactions WHERE status = 'paid' AND ($1::timestamptz IS NULL OR paid_at >= $1)`,
    [sinceIso || null]
  );
  return rows.map((r) => ({ type: r.type, amount: Number(r.amount) }));
}

// --- payme transactions ------------------------------------------------------

function rowToPaymeTx(row) {
  return {
    paymeId: row.payme_id,
    merchantTransId: row.merchant_trans_id,
    amountTiyin: Number(row.amount_tiyin),
    state: Number(row.state),
    reason: row.reason === null ? null : Number(row.reason),
    createTime: Number(row.create_time),
    performTime: Number(row.perform_time),
    cancelTime: Number(row.cancel_time),
  };
}

async function getPaymeTransaction(paymeId) {
  const { rows } = await query(`SELECT * FROM payme_transactions WHERE payme_id = $1`, [String(paymeId)]);
  return rows[0] ? rowToPaymeTx(rows[0]) : null;
}

// The most recent transaction against an order -- used to refuse opening a
// second live one while one is already waiting to be performed.
async function getPaymeTransactionByOrder(merchantTransId) {
  const { rows } = await query(
    `SELECT * FROM payme_transactions WHERE merchant_trans_id = $1 ORDER BY create_time DESC LIMIT 1`,
    [String(merchantTransId)]
  );
  return rows[0] ? rowToPaymeTx(rows[0]) : null;
}

async function createPaymeTransaction({ paymeId, merchantTransId, amountTiyin, state, createTime }) {
  await query(
    `INSERT INTO payme_transactions (payme_id, merchant_trans_id, amount_tiyin, state, create_time)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (payme_id) DO NOTHING`,
    [String(paymeId), String(merchantTransId), amountTiyin, state, createTime]
  );
}

async function setPaymeTransactionState(paymeId, state, { performTime, cancelTime, reason } = {}) {
  await query(
    `UPDATE payme_transactions
        SET state = $2,
            perform_time = COALESCE($3, perform_time),
            cancel_time  = COALESCE($4, cancel_time),
            reason       = COALESCE($5, reason)
      WHERE payme_id = $1`,
    [String(paymeId), state, performTime ?? null, cancelTime ?? null, reason ?? null]
  );
}

async function listPaymeTransactions(from, to) {
  const { rows } = await query(
    `SELECT * FROM payme_transactions WHERE create_time >= $1 AND create_time <= $2 ORDER BY create_time`,
    [from, to]
  );
  return rows.map(rowToPaymeTx);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  init, close,
  getProfile, saveProfile, deleteProfile, getAllProfiles, setProfileActive, setTelegramUsername,
  searchProfiles, getProfileStats, listAllProfileIds,
  pickCandidateRow,
  setPremiumUntil, hasPremium, setAnonGenderFilterUntil, hasAnonGenderFilter,
  grantVipChat, hasVipChat, isAdmin, addAdmin, listAdmins, removeAdmin, getLanguage, setLanguage,
  recordLike, getLikers, hasLiked, getMyLikes, hasUnlocked, grantUnlock,
  createReferral, getReferral, markReferralRewarded, countReferrals,
  getUnlockCredits, addUnlockCredits, consumeUnlockCredit,
  getLikeNoticeAt, setLikeNoticeAt,
  countPendingLikers,
  backfillMatchUnlocks,
  touchLastSeen, listWinbackTargets, markWinbackSent, markBotBlocked,
  setNotificationsEnabled, getNotificationsEnabled, countNewProfilesSince,
  recordDislike, getDislikes, getDiscoverState, setDiscoverState, clearDiscoverState,
  createComplaint, getComplaint, listComplaints, setComplaintReply,
  getTransaction, findPendingOrder, createTransaction, updateTransactionAmount,
  markTransaction, getSalesRows,
  getPaymeTransaction, getPaymeTransactionByOrder, createPaymeTransaction,
  setPaymeTransactionState, listPaymeTransactions,
  listUndeliveredOrders, markDelivered, bumpDeliveryAttempts,
};
