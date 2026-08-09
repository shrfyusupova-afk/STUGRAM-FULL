// The admin AI assistant must never invent numbers -- it can only report
// what buildDataSnapshot actually computed from storage. These tests check
// the snapshot itself (real data, no network) and that the feature degrades
// cleanly (not a crash) when ANTHROPIC_API_KEY is absent, which it is in CI.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const db = require("../src/db");
const { isConfigured, askAdminAssistant, __test } = require("../src/aiAssistant");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("with no ANTHROPIC_API_KEY, the feature reports itself unconfigured instead of crashing", async () => {
  assert.strictEqual(isConfigured(), false);
  await assert.rejects(() => askAdminAssistant("oxirgi oy hisobot"));
});

test("the data snapshot only ever contains numbers pulled from real storage", async () => {
  await db.saveProfile("910001", {
    name: "A", age: 24, gender: "male", genderLabel: "Erkak",
    location: "Toshkent", bio: "b", phone: "+998900009101",
    mediaFileId: "F", mediaType: "photo",
  });
  await db.saveProfile("910002", {
    name: "B", age: 23, gender: "female", genderLabel: "Ayol",
    location: "Toshkent", bio: "b", phone: "+998900009102",
    mediaFileId: "F", mediaType: "photo",
  });

  const snapshot = await __test.buildDataSnapshot();

  assert.ok(snapshot.profiles.total >= 2, "the two just-created profiles are counted");
  assert.strictEqual(snapshot.newRegistrationsLast30Days.total, snapshot.profiles.total, "both were just created, so both fall inside the last 30 days");
  assert.strictEqual(snapshot.complaints.total, snapshot.complaints.pending + snapshot.complaints.answered, "pending + answered must account for every complaint");
  assert.ok(typeof snapshot.salesAllTime.premium.totalRevenue === "number");
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
