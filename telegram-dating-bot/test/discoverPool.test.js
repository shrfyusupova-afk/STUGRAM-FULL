// A liked profile must never come back. This is the bug behind "I liked
// someone and then the exact same profile kept showing up again" -- on a
// small candidate pool (which this bot has, being new), a liked profile was
// excluded only by an ephemeral "shown" cache that the recycling fallback
// deliberately wipes once everyone has been seen. The moment that happened,
// already-liked people were fair game again.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const db = require("../src/db");
const { __test } = require("../src/discover");
const { pickCandidate } = __test;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const candidate = (id, overrides = {}) => ({
  name: `C${id}`, age: 24, gender: "female", genderLabel: "Ayol",
  location: "Toshkent", bio: "b", phone: `+99890000${id}`,
  mediaFileId: "F", mediaType: "photo", active: true,
  ...overrides,
});

test("a liked candidate never comes back, even after the pool runs dry", async () => {
  const viewer = "800100";
  await db.saveProfile(viewer, {
    name: "Viewer", age: 24, gender: "male", genderLabel: "Erkak",
    location: "Toshkent", bio: "b", phone: "+998900008000",
    mediaFileId: "F", mediaType: "photo",
  });

  const ids = ["800101", "800102", "800103"];
  for (const id of ids) await db.saveProfile(id, candidate(id));

  // Like every single candidate in this small pool, one swipe at a time --
  // exactly the sequence that used to reintroduce the first one once the
  // pool had nobody left unseen.
  const seenOrder = [];
  for (let i = 0; i < ids.length; i++) {
    const picked = await pickCandidate(viewer, "male");
    assert.ok(picked, `expected a candidate on swipe ${i + 1}`);
    assert.ok(!seenOrder.includes(picked.id), `${picked.id} was shown twice before every candidate was liked once`);
    seenOrder.push(picked.id);
    await db.recordLike(viewer, picked.id);
  }
  assert.strictEqual(seenOrder.length, ids.length, "every candidate was shown exactly once");

  // The pool is now fully liked. This is exactly the moment the old
  // "recycled" fallback kicked in and handed back someone already liked.
  const afterExhaustion = await pickCandidate(viewer, "male");
  assert.strictEqual(afterExhaustion, null, "nobody is left -- a liked profile must not resurface");
});

test("a disliked candidate never comes back either, for the same reason", async () => {
  const viewer = "800200";
  await db.saveProfile(viewer, {
    name: "Viewer2", age: 24, gender: "male", genderLabel: "Erkak",
    location: "Toshkent", bio: "b", phone: "+998900008001",
    mediaFileId: "F", mediaType: "photo",
  });

  // This viewer is new, but the pool is not -- the previous test's
  // candidates are still valid, unreacted-to profiles from THIS viewer's
  // point of view. Drain them first so the pool is genuinely empty before
  // adding the one candidate this test actually cares about.
  for (let picked = await pickCandidate(viewer, "male"); picked; picked = await pickCandidate(viewer, "male")) {
    await db.recordDislike(viewer, picked.id);
  }

  const only = "800201";
  await db.saveProfile(only, candidate(only));

  const picked = await pickCandidate(viewer, "male");
  assert.strictEqual(picked.id, only);
  await db.recordDislike(viewer, only);

  assert.strictEqual(await pickCandidate(viewer, "male"), null, "a disliked profile must not resurface either");
});

// --- go ----------------------------------------------------------------------
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
