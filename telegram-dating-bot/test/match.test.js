// Who gets the contact when two people match.
//
// The rule: BOTH of them. Two people chose each other, so neither is asked
// for money before they can reach the other -- a match that only one side can
// act on is half a match, and charging the one who said yes reads as a
// penalty for saying yes.
//
// That makes this a file about a boundary rather than a payout: the paywall
// still has to stand everywhere there is no mutual interest. So most of these
// cases check the OTHER side of the line -- one-sided likes, strangers, the
// likes list before anyone has answered -- because "a match opens both" is
// only safe if "a like opens nothing" still holds.
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
const gotContact = (calls) => calls.some((c) => /📞/.test(c.payload.caption || "") || /📞/.test(c.payload.text || ""));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- the core rule -----------------------------------------------------------
test("a match gives BOTH of them the contact", async () => {
  const first = user("First");
  const second = user("Second");
  await register(first, { gender: "male", name: "First" });
  await register(second, { gender: "female", name: "Second" });

  // First likes Second. Not mutual yet, so nothing is granted either way --
  // this is the half that must keep working, or a single like would buy
  // access to a stranger.
  await likeFrom(first, "Second");
  assert.strictEqual(await db.hasUnlocked(first.id, second.id), false, "a one-sided like grants nothing");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), false);

  // Second answers -> match.
  const sent = await likeFrom(second, "First");

  assert.strictEqual(await db.hasUnlocked(first.id, second.id), true, "the one who liked first gets access");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), true, "and so does the one who answered");

  // What each of them was actually shown -- the grant is only half the point;
  // neither should have to go looking for it.
  const toFirst = to(sent, first);
  assert.match(textOf(toFirst), /mos tushdingiz/, "the first liker is told");
  assert.ok(
    toFirst.some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "and receives the card with the phone number on it"
  );

  const toSecond = to(sent, second);
  assert.match(textOf(toSecond), /mos tushdingiz/, "the responder is told too");
  assert.ok(
    toSecond.some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "and receives the same card, with the number on it"
  );
  assert.ok(!/Bu funksiya pullik/.test(textOf(toSecond)), "and is never sent to a paywall for it");
});

// --- the likes list shows what each side actually has -------------------------
test("after a match, both likes lists show the contact", async () => {
  const first = user("Alpha");
  const second = user("Beta");
  await register(first, { gender: "male", name: "Alpha" });
  await register(second, { gender: "female", name: "Beta" });

  await likeFrom(first, "Beta");
  await likeFrom(second, "Alpha"); // match

  const hers = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", second));
  const hisList = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", first));

  // Both lists may be empty of pending likers (each has answered the other),
  // so this asserts only that neither is refused access when a card is drawn.
  const hersText = textOf(to(hers, second));
  const hisText = textOf(to(hisList, first));
  assert.ok(!/Bu funksiya pullik/.test(hersText), "the responder is not paywalled on a matched profile");
  assert.ok(!/Bu funksiya pullik/.test(hisText), "and neither is the first liker");
});

// The line the whole change depends on: answering a like opens that person,
// and ONLY that person. A stranger nobody has matched with stays shut.
test("a match opens only the person matched with, not everyone", async () => {
  const me = user("Mine");
  const partner = user("Partner");
  const stranger = user("Stranger");
  await register(me, { gender: "male", name: "Mine" });
  await register(partner, { gender: "female", name: "Partner" });
  await register(stranger, { gender: "female", name: "Stranger" });

  await likeFrom(partner, "Mine");
  await likeFrom(me, "Partner"); // match

  assert.strictEqual(await db.hasUnlocked(me.id, partner.id), true, "the match is open");
  assert.strictEqual(await db.hasUnlocked(me.id, stranger.id), false, "the stranger is not");

  const sent = await h.send(M(), h.commandUpdate(`/start unlock_${stranger.id}`, me));
  assert.ok(!gotContact(to(sent, me)), "opening a stranger must still cost");
  assert.match(textOf(to(sent, me)), /Bu funksiya pullik/, "and must still say so");
});

// Somebody who liked you but has NOT been answered is not a match, so their
// contact stays behind the paywall. This is the case most easily broken by a
// change that grants "both directions" too early.
test("being liked by somebody is not a match and opens nothing", async () => {
  const admired = user("Admired");
  const admirer = user("Admirer");
  await register(admired, { gender: "female", name: "Admired" });
  await register(admirer, { gender: "male", name: "Admirer" });

  await likeFrom(admirer, "Admired");

  assert.strictEqual(await db.hasUnlocked(admired.id, admirer.id), false, "she has not answered");
  assert.strictEqual(await db.hasUnlocked(admirer.id, admired.id), false, "and he is not owed her contact");

  const sent = await h.send(M(), h.commandUpdate(`/start unlock_${admirer.id}`, admired));
  assert.ok(!gotContact(to(sent, admired)), "his number is not hers for free yet");
});

// --- liking back from the list is the same path -------------------------------
test("answering from the likes list opens the contact in place", async () => {
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
  assert.ok(/📞/.test(textOf(edited)), "and gains the phone number, since this is now a match");

  assert.strictEqual(await db.hasUnlocked(first.id, second.id), true);
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), true, "answering opens it for her too");

  // The card was rewritten in place, so a second copy of the same profile
  // pushed underneath it would be pure noise.
  const cards = to(sent, second).filter((c) => c.method === "sendPhoto");
  assert.strictEqual(cards.length, 0, "no duplicate profile card on top of the rewritten one");
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
test("pairs that matched before this change get both sides too", async () => {
  const a = user("OldA");
  const b = user("OldB");
  await register(a, { gender: "male", name: "OldA" });
  await register(b, { gender: "female", name: "OldB" });

  // Mutual likes, no unlock rows at all -- what a pair that matched under the
  // old one-sided rule can look like on disk.
  await db.recordLike(a.id, b.id);
  await db.recordLike(b.id, a.id);
  assert.strictEqual(await db.hasUnlocked(a.id, b.id), false);
  assert.strictEqual(await db.hasUnlocked(b.id, a.id), false);

  const granted = await db.backfillMatchUnlocks();
  assert.ok(granted >= 2, `expected both sides granted, got ${granted}`);
  assert.strictEqual(await db.hasUnlocked(a.id, b.id), true, "both sides open");
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
