// The failures that take the WHOLE service down, rather than one feature.
//
// Nothing here is about a button doing the wrong thing. These are the ways a
// bot that works fine at fifty users stops working at fifty thousand: memory
// that is never handed back, one screen that turns into a thousand database
// queries, and a bulk send that quietly drops most of its messages while
// reporting success.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const { floodGuardMiddleware, __test: flood } = require("../src/floodGuard");
const { isGoneError, retryAfterMs } = require("../src/telegramSafety");
const db = require("../src/db");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- memory --------------------------------------------------------------
// The flood guard kept one entry per person who ever sent an update and
// removed none of them. At a hundred thousand users that is a hundred thousand
// live objects held for windows that closed days ago -- on a 512 MB instance,
// an out-of-memory kill, which looks to everyone like "the bot randomly died".
test("the flood guard hands its memory back", async () => {
  const noop = async () => {};
  const PEOPLE = 50_000;

  for (let i = 1; i <= PEOPLE; i++) floodGuardMiddleware({ from: { id: i } }, noop);
  assert.strictEqual(flood.size(), PEOPLE, "everyone is tracked while their window is open");

  // Their windows close.
  const later = Date.now() + flood.WINDOW_MS + 1000;
  assert.strictEqual(flood.sweep(later), PEOPLE, "every stale entry is swept");
  assert.strictEqual(flood.size(), 0, "and nothing is left behind");
});

test("sweeping does not let a live flooder through", async () => {
  const noop = async () => {};
  const FLOODER = 4242;

  for (let i = 0; i < flood.MAX_PER_WINDOW + 20; i++) floodGuardMiddleware({ from: { id: FLOODER } }, noop);

  // A sweep runs while they are still inside their window.
  flood.sweep(Date.now());
  assert.strictEqual(flood.size() >= 1, true, "an open window survives");

  let allowed = 0;
  for (let i = 0; i < 10; i++) {
    floodGuardMiddleware({ from: { id: FLOODER } }, async () => {
      allowed++;
    });
  }
  assert.strictEqual(allowed, 0, "the limit still applies after a sweep");
});

// --- the query that multiplied ------------------------------------------
// "How many people liked you" was one query for the likers plus TWO MORE per
// liker. It runs on every like received, on every Mini App open, and once per
// person in a win-back sweep -- so one sweep over 200 idle users, each with
// fifty admirers, was twenty thousand queries against a five-connection pool,
// with every real user's swipe queued behind them.
test("counting admirers is one operation, not one per admirer", async () => {
  const her = "800001";
  await db.saveProfile(her, {
    name: "Popular", age: 22, gender: "female", genderLabel: "Ayol",
    location: "Toshkent", bio: "b", phone: "+998900000001",
    mediaFileId: "F", mediaType: "photo",
  });

  const ADMIRERS = 300;
  for (let i = 0; i < ADMIRERS; i++) {
    const id = String(810000 + i);
    await db.saveProfile(id, {
      name: `Fan${i}`, age: 25, gender: "male", genderLabel: "Erkak",
      location: "Toshkent", bio: "b", phone: `+99890000${1000 + i}`,
      mediaFileId: "F", mediaType: "photo",
    });
    await db.recordLike(id, her);
  }

  assert.strictEqual(await db.countPendingLikers(her), ADMIRERS, "all of them are waiting");

  // Answering one removes them from the count -- the number and the list the
  // person sees underneath it have to agree.
  await db.recordLike(her, "810000");
  assert.strictEqual(await db.countPendingLikers(her), ADMIRERS - 1, "an answered like no longer waits");

  // Somebody whose anketa was hidden is not counted either, for the same
  // reason: the list will not show them.
  await db.setProfileActive("810001", false);
  assert.strictEqual(await db.countPendingLikers(her), ADMIRERS - 2, "a hidden admirer is not counted");

  // And it stays fast. This is a wall-clock check on purpose: the point of the
  // change is the shape of the work, and 300 admirers under the old code was
  // 601 round trips.
  const started = Date.now();
  for (let i = 0; i < 20; i++) await db.countPendingLikers(her);
  const perCall = (Date.now() - started) / 20;
  assert.ok(perCall < 50, `counting took ${perCall.toFixed(1)}ms per call -- expected a single operation`);
});

// --- telling Telegram's answers apart -------------------------------------
// A broadcast counted BOTH as "they blocked us". So a run that Telegram
// throttled reported thousands of blocks, the messages were silently dropped,
// and the operator had a comfortable explanation for a broadcast that mostly
// never arrived.
test("being blocked and being throttled are not the same answer", () => {
  const blocked = { response: { error_code: 403, description: "Forbidden: bot was blocked by the user" } };
  const deactivated = { response: { error_code: 403, description: "Forbidden: user is deactivated" } };
  const throttled = { response: { error_code: 429, parameters: { retry_after: 12 } } };
  const chatGone = { response: { error_code: 400, description: "Bad Request: chat not found" } };

  assert.strictEqual(isGoneError(blocked), true);
  assert.strictEqual(isGoneError(deactivated), true);
  assert.strictEqual(isGoneError(throttled), false, "a rate limit is not a block");
  assert.strictEqual(isGoneError(chatGone), false);

  assert.strictEqual(retryAfterMs(throttled), 13_000, "wait what Telegram asked, plus slack");
  assert.strictEqual(retryAfterMs(blocked), null);
  assert.strictEqual(retryAfterMs(chatGone), null);
  assert.strictEqual(retryAfterMs(new Error("network reset")), null);
});

// --- go --------------------------------------------------------------------
(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok   - ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL - ${name}\n       ${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
