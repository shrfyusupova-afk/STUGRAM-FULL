// Comping a paid feature from the admin panel -- to yourself, or to anyone.
//
// Two things have to hold. The gift must be indistinguishable from a real
// purchase everywhere downstream (or the owner's own "free VIP" would not
// actually open anything), and it must NOT be counted as revenue (or every
// figure on the Sotuvlar and To'liq hisobot screens quietly becomes fiction).
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { getSalesSummary, PREMIUM_DAYS, ANON_GENDER_DAYS } = require("../src/click");

const M = () => h.mainBot();
const A = () => h.adminBot();

let nextId = 980000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

async function register(u, { gender = "male", name = "T" } = {}) {
  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate(name, u));
  await h.send(M(), h.textUpdate("22", u));
  await h.send(M(), h.callbackUpdate(`gender:${gender}`, u));
  await h.send(M(), h.photoUpdate(u));
  await h.send(M(), h.textUpdate("Toshkent", u));
  await h.send(M(), h.textUpdate("Salom", u));
  await h.send(M(), h.contactUpdate(`+9989${u.id}`, u));
  return h.send(M(), h.textUpdate("✅ Ha", u));
}

// The admin bot hides its PIN pad behind /iamadmin. The PIN is the one the
// harness pins for the whole suite -- it overrides ADMIN_PIN_CODE itself, so
// setting a different one here would only ever produce a lockout.
const ADMIN_PIN = "13579";
async function loginAdmin(admin) {
  await h.send(A(), h.commandUpdate("/iamadmin", admin));
  for (const d of ADMIN_PIN) await h.send(A(), h.callbackUpdate(`admin:pin:${d}`, admin));
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists and is logged in", async () => {
  admin = user("Owner");
  await register(admin, { gender: "male", name: "Owner" });
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));
});

test("the owner can give themselves VIP, and it really opens the chat", async () => {
  assert.strictEqual(await db.hasVipChat(admin.id), false, "starts without VIP");

  await h.send(A(), h.callbackUpdate(`admin:gift:vip:${admin.id}`, admin));
  assert.strictEqual(await db.hasVipChat(admin.id), true, "the gift is recorded");

  // The real test: the MAIN bot must now let them through, exactly as it
  // would for somebody who paid 59,900.
  const opened = await h.send(M(), h.textUpdate("👑 VIP suhbat", admin));
  const text = opened.map((c) => c.payload.text || "").join("\n");
  assert.match(text, /t\.me\//, `VIP must hand over the invite link, got: ${text.slice(0, 160)}`);
  assert.ok(!/pullik|so'm/.test(text), "and must not still be asking for payment");
});

test("Premium and the anonymous filter are granted with real expiry dates", async () => {
  await h.send(A(), h.callbackUpdate(`admin:gift:premium:${admin.id}`, admin));
  assert.strictEqual(await db.hasPremium(admin.id), true, "Premium is active");

  await h.send(A(), h.callbackUpdate(`admin:gift:anon:${admin.id}`, admin));
  assert.strictEqual(await db.hasAnonGenderFilter(admin.id), true, "the anon filter is active");

  const profile = await db.getProfile(admin.id);
  const daysLeft = (iso) => (new Date(iso).getTime() - Date.now()) / 86400000;
  assert.ok(Math.abs(daysLeft(profile.premiumUntil) - PREMIUM_DAYS) < 1, "Premium runs the full period");
  assert.ok(Math.abs(daysLeft(profile.anonGenderUntil) - ANON_GENDER_DAYS) < 1, "so does the anon filter");
});

test("gifting again ADDS to the time left instead of throwing it away", async () => {
  const before = new Date((await db.getProfile(admin.id)).premiumUntil).getTime();
  await h.send(A(), h.callbackUpdate(`admin:gift:premium:${admin.id}`, admin));
  const after = new Date((await db.getProfile(admin.id)).premiumUntil).getTime();

  const addedDays = (after - before) / 86400000;
  assert.ok(
    Math.abs(addedDays - PREMIUM_DAYS) < 1,
    `topping up must add ${PREMIUM_DAYS} days to what was left, added ${addedDays.toFixed(1)}`
  );
});

test("free unlock credits are handed over and actually spendable", async () => {
  const before = await db.getUnlockCredits(admin.id);
  await h.send(A(), h.callbackUpdate(`admin:gift:credits:${admin.id}`, admin));
  const after = await db.getUnlockCredits(admin.id);
  assert.strictEqual(after - before, 5, "five credits arrive");

  assert.strictEqual(await db.consumeUnlockCredit(admin.id), true, "and one can be spent");
  assert.strictEqual(await db.getUnlockCredits(admin.id), after - 1);
});

test("the person is told about their gift, through the MAIN bot", async () => {
  const lucky = user("Lucky");
  await register(lucky, { gender: "female", name: "Lucky" });

  const sent = await h.send(A(), h.callbackUpdate(`admin:gift:premium:${lucky.id}`, admin));
  const toThem = sent.filter((c) => String(c.payload.chat_id) === String(lucky.id));
  assert.ok(toThem.length > 0, "a gift nobody is told about is not a gift");
  assert.match(toThem.map((c) => c.payload.text || "").join("\n"), /sovg'a/i);
});

// This is the one that protects the numbers the whole business is read from.
test("a gift is NEVER counted as revenue", async () => {
  const before = await getSalesSummary();

  const freeloader = user("Comped");
  await register(freeloader, { gender: "male", name: "Comped" });
  for (const kind of ["premium", "vip", "anon", "credits"]) {
    await h.send(A(), h.callbackUpdate(`admin:gift:${kind}:${freeloader.id}`, admin));
  }

  const after = await getSalesSummary();
  for (const type of ["premium", "unlock", "vipchat", "anongender"]) {
    assert.strictEqual(
      after[type].totalRevenue,
      before[type].totalRevenue,
      `${type} revenue moved on a gift -- the sales figures are now fiction`
    );
    assert.strictEqual(after[type].count, before[type].count, `${type} sale count moved on a gift`);
  }
});

test("a non-admin cannot gift anything to anyone", async () => {
  const stranger = user("Nobody");
  await register(stranger, { gender: "male", name: "Nobody" });
  assert.strictEqual(await db.hasVipChat(stranger.id), false);

  // Tapping the button with someone else's id, without being an admin.
  await h.send(A(), h.callbackUpdate(`admin:gift:vip:${stranger.id}`, stranger));
  assert.strictEqual(await db.hasVipChat(stranger.id), false, "the panel must ignore a stranger entirely");
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
