// Who gets the contact when two people match.
//
// The rule: the person who liked FIRST gets it. The one who answers does not
// -- they already knew somebody was interested, so for them the contact is
// something to pay for, or to earn with invites, or to be given when the
// other person writes first.
//
// This is worth its own file because it is a rule about MONEY that is easy to
// leak by accident. The contact can escape through three different screens --
// the match message, the likes list, and the card that is rewritten when you
// like somebody back -- and each of those used to decide it separately.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

process.env.CLICK_MERCHANT_ID = "1111";
process.env.CLICK_SERVICE_ID = "2222";
process.env.CLICK_SECRET_KEY = "TOPSECRET";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { __test } = require("../src/discover");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const M = () => h.mainBot();

let nextId = 960000;
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

async function likeFrom(liker, targetName, limit = 30) {
  let sent = await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", liker));
  for (let i = 0; i < limit; i++) {
    const card = sent.find((c) => c.method === "sendPhoto");
    if (card && (card.payload.caption || "").includes(targetName)) {
      const before = h.calls.length;
      await h.send(M(), h.textUpdate("❤️", liker));
      await __test.pendingNotifications();
      return h.calls.slice(before);
    }
    sent = await h.send(M(), h.textUpdate("👎", liker));
  }
  throw new Error(`never reached ${targetName}`);
}

const to = (sent, u) => sent.filter((c) => String(c.payload.chat_id) === String(u.id));
const textOf = (calls) => calls.map((c) => c.payload.text || c.payload.caption || "").join("\n");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- the core rule -----------------------------------------------------------
test("on a match only the FIRST liker is given the contact", async () => {
  const first = user("First");
  const second = user("Second");
  await register(first, { gender: "male", name: "First" });
  await register(second, { gender: "female", name: "Second" });

  // First likes Second. Not mutual yet, so nothing is granted either way.
  await likeFrom(first, "Second");
  assert.strictEqual(await db.hasUnlocked(first.id, second.id), false, "not a match yet");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), false);

  // Second answers -> match.
  const sent = await likeFrom(second, "First");

  assert.strictEqual(await db.hasUnlocked(first.id, second.id), true, "the first liker gets access");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), false, "the responder does not");

  // What each of them was actually shown.
  const toFirst = textOf(to(sent, first));
  assert.match(toFirst, /mos tushdingiz/, "the first liker is told");
  assert.ok(
    to(sent, first).some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "and receives the card with the phone number on it"
  );

  const toSecond = textOf(to(sent, second));
  assert.match(toSecond, /mos tushdingiz/, "the responder is told too");
  assert.match(toSecond, /birinchi bo'lib yozishi mumkin/, "and told what that means for them");
  assert.ok(
    !to(sent, second).some((c) => /📞/.test(c.payload.caption || "") || /📞/.test(c.payload.text || "")),
    "but is NOT shown the number"
  );
  assert.match(toSecond, /Bu funksiya pullik/, "they are offered the unlock instead");
});

// --- the likes list must not leak it ------------------------------------------
test("the likes list does not hand the responder the number either", async () => {
  const first = user("Alpha");
  const second = user("Beta");
  await register(first, { gender: "male", name: "Alpha" });
  await register(second, { gender: "female", name: "Beta" });

  await likeFrom(first, "Beta");
  await likeFrom(second, "Alpha"); // match; Beta is the responder

  // Beta opens her likes list. Alpha is in it, and they are a mutual match --
  // which used to be enough to print his phone number right on the card.
  const list = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", second));
  const shown = textOf(to(list, second));
  assert.ok(!/📞/.test(shown), `the list leaked a contact: ${shown.slice(0, 200)}`);

  // Alpha's own list, on the other hand, may show it -- he earned it.
  const hisList = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", first));
  const hisShown = textOf(to(hisList, first));
  if (hisShown.length) assert.match(hisShown, /📞|hech kim/, "the first liker keeps his access");
});

// --- liking back from the list is the same path -------------------------------
test("answering from the likes list does not reveal the number", async () => {
  const first = user("Gamma");
  const second = user("Delta");
  await register(first, { gender: "male", name: "Gamma" });
  await register(second, { gender: "female", name: "Delta" });

  await likeFrom(first, "Delta");
  // Delta answers from her likes list rather than from browsing.
  await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", second));
  const sent = await h.send(M(), h.callbackUpdate(`likeback:like:${first.id}`, second));
  await __test.pendingNotifications();

  const edited = sent.filter((c) => c.method === "editMessageCaption");
  assert.ok(edited.length > 0, "the card is rewritten in place");
  assert.ok(!/📞/.test(textOf(edited)), "and must not gain a phone number");

  assert.strictEqual(await db.hasUnlocked(first.id, second.id), true, "Gamma liked first, so Gamma gets it");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), false);
});

// --- the responder can still get there ----------------------------------------
test("the responder can unlock with a referral credit", async () => {
  const first = user("Eps");
  const second = user("Zeta");
  await register(first, { gender: "male", name: "Eps" });
  await register(second, { gender: "female", name: "Zeta" });

  await likeFrom(first, "Zeta");
  await likeFrom(second, "Eps");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), false);

  await db.addUnlockCredits(second.id, 1);
  const used = await h.send(M(), h.callbackUpdate(`unlock:credit:${first.id}`, second));
  assert.ok(
    to(used, second).some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "spending a credit shows the contact"
  );
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), true);
  assert.strictEqual(await db.getUnlockCredits(second.id), 0);
});

test("Premium still sees everyone, match or not", async () => {
  const rich = user("Rich");
  const other = user("Other");
  await register(rich, { gender: "male", name: "Rich" });
  await register(other, { gender: "female", name: "Other" });

  await db.setPremiumUntil(rich.id, new Date(Date.now() + 86400000).toISOString());
  const sent = await h.send(M(), h.commandUpdate(`/start unlock_${other.id}`, rich));
  assert.ok(
    to(sent, rich).some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "Premium opens a profile with no match and no payment"
  );
});

// --- nobody loses what they already had ----------------------------------------
test("pairs that matched under the old rule keep their access", async () => {
  const a = user("OldA");
  const b = user("OldB");
  await register(a, { gender: "male", name: "OldA" });
  await register(b, { gender: "female", name: "OldB" });

  // Recreate the old state directly: mutual likes, no unlock rows at all --
  // exactly what a pair that matched before this change looks like on disk.
  await db.recordLike(a.id, b.id);
  await db.recordLike(b.id, a.id);
  assert.strictEqual(await db.hasUnlocked(a.id, b.id), false);
  assert.strictEqual(await db.hasUnlocked(b.id, a.id), false);

  const granted = await db.backfillMatchUnlocks();
  assert.ok(granted >= 2, `expected both sides granted, got ${granted}`);
  assert.strictEqual(await db.hasUnlocked(a.id, b.id), true, "both keep what they had");
  assert.strictEqual(await db.hasUnlocked(b.id, a.id), true);

  // Running it again must change nothing.
  assert.strictEqual(await db.backfillMatchUnlocks(), 0, "the backfill is idempotent");
});

// --- go ------------------------------------------------------------------------
(async () => {
  await wait(1000);
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
