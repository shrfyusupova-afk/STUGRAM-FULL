// The Postgres half of the storage layer, against a REAL server. The other
// suites run on the JSON backend, which cannot prove the things that only
// exist in SQL: that ALTER TABLE ... ADD COLUMN IF NOT EXISTS is safe to run
// on every boot, that a pre-existing row picks up the new column's DEFAULT
// rather than NULL, and that "spend a credit" refuses to go negative inside
// the statement rather than in the caller.
//
// Opt-in, because it needs a database:
//   DATABASE_URL=postgres://... npm run test:pg
//
// Point it at a THROWAWAY database. It writes and deletes rows.
const assert = require("assert");

if (!process.env.DATABASE_URL) {
  console.log("skipped - set DATABASE_URL to a throwaway database to run these");
  process.exit(0);
}

const pg = require("../src/storage/pgStore");

(async () => {
  // 1. A database that predates this feature: create the OLD schema only.
  await pg.init();
  console.log("init #1 ok (fresh database)");

  // Put a profile in, as an existing deployment would have.
  await pg.saveProfile(1001, { name: "Eski", age: 30, gender: "male", genderLabel: "Erkak",
    location: "Toshkent", bio: "bio", phone: "+998901112233", mediaFileId: "F", mediaType: "photo" });

  // 2. Run init() again -- this is what every single deploy does.
  await pg.init();
  console.log("init #2 ok (idempotent)");
  await pg.init();
  console.log("init #3 ok");

  // The pre-existing row must be untouched and must have picked up the
  // column's default rather than NULL.
  const kept = await pg.getProfile(1001);
  assert.strictEqual(kept.name, "Eski", "existing data survived");
  assert.strictEqual(await pg.getUnlockCredits(1001), 0, "existing profiles start at 0, not NULL");

  // 3. The referral rules, against real SQL rather than the JSON stand-in.
  assert.strictEqual(await pg.createReferral(1001, 2001), true, "first claim wins");
  assert.strictEqual(await pg.createReferral(1002, 2001), false, "a second referrer cannot claim the same person");
  const row = await pg.getReferral(2001);
  assert.strictEqual(String(row.referrerId), "1001");
  assert.strictEqual(row.rewarded, false);

  assert.strictEqual(await pg.markReferralRewarded(2001), true, "claimed once");
  assert.strictEqual(await pg.markReferralRewarded(2001), false, "never twice");

  assert.strictEqual(await pg.countReferrals(1001, { rewardedOnly: true }), 1);
  assert.strictEqual(await pg.countReferrals(1001, { sinceIso: new Date(Date.now() + 60000).toISOString() }), 0,
    "the time window is applied");

  // 4. Credits: the decrement must refuse to go below zero in SQL, not just
  //    in the caller.
  assert.strictEqual(await pg.consumeUnlockCredit(1001), false, "cannot spend from an empty balance");
  assert.strictEqual(await pg.addUnlockCredits(1001, 1), 1);
  assert.strictEqual(await pg.consumeUnlockCredit(1001), true);
  assert.strictEqual(await pg.consumeUnlockCredit(1001), false, "and it is empty again");
  assert.strictEqual(await pg.getUnlockCredits(1001), 0, "never negative");

  // 5. Deleting an account must NOT erase the referral row -- that is what
  //    stops delete-and-rejoin farming.
  await pg.deleteProfile(2001);
  assert.ok(await pg.getReferral(2001), "the referral record outlives the profile");

  // 6. The like-milestone marker: same story as unlock_credits -- a profile
  //    written before the column existed must read as 0, not NULL.
  assert.strictEqual(await pg.getLikeNoticeAt(1001), 0, "existing profiles start at 0, not NULL");
  await pg.setLikeNoticeAt(1001, 5);
  assert.strictEqual(await pg.getLikeNoticeAt(1001), 5);
  await pg.setLikeNoticeAt(1001, 3);
  assert.strictEqual(await pg.getLikeNoticeAt(1001), 3, "the marker must be able to go DOWN again");

  // 7. Win-back state. The important one is the idle fallback: a profile with
  //    no last_seen_at must be judged by updated_at, not treated as
  //    infinitely idle -- otherwise a signup from this afternoon lands in the
  //    day-3 batch.
  const fresh = "1002";
  await pg.saveProfile(fresh, { name: "Yangi", age: 25, gender: "male", genderLabel: "Erkak",
    location: "Toshkent", bio: "bio", phone: "+998900000002", mediaFileId: "F", mediaType: "photo" });
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert.strictEqual(
    (await pg.listWinbackTargets(3, threeDaysAgo, 50)).some((t) => t.userId === fresh),
    false,
    "a profile saved just now is not idle, even with last_seen_at NULL"
  );

  await pg.touchLastSeen(fresh);
  await pg.markWinbackSent(fresh, 3);
  assert.strictEqual(
    (await pg.listWinbackTargets(3, new Date().toISOString(), 50)).some((t) => t.userId === fresh),
    false,
    "a stage already sent is not re-sent"
  );
  await pg.touchLastSeen(fresh);
  assert.strictEqual(await pg.getNotificationsEnabled(fresh), true, "defaults to on");
  await pg.setNotificationsEnabled(fresh, false);
  assert.strictEqual(await pg.getNotificationsEnabled(fresh), false);
  await pg.markBotBlocked(fresh);
  assert.strictEqual(
    (await pg.listWinbackTargets(7, new Date().toISOString(), 50)).some((t) => t.userId === fresh),
    false,
    "blocked and opted out are both excluded"
  );
  assert.ok((await pg.countNewProfilesSince("male", threeDaysAgo)) >= 1, "new profiles are counted");

  console.log("\nall postgres migration + referral checks passed");
  await pg.close();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
