// Who gets the contact when two people match.
//
// The rule: the person who liked FIRST gets it, and only them. They took the
// risk of liking a stranger with nothing in return; the reward for that is
// the connection. The one answering already knew somebody was interested --
// they saw it in their likes list -- so for them the contact is something to
// pay for, to earn with invites, or to be given when the other writes first.
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
const gotContact = (calls) => calls.some((c) => /📞/.test(c.payload.caption || "") || /📞/.test(c.payload.text || ""));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- the core rule -----------------------------------------------------------
test("on a match only the FIRST liker is given the contact", async () => {
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

  assert.strictEqual(await db.hasUnlocked(first.id, second.id), true, "the first liker gets access");
  assert.strictEqual(await db.hasUnlocked(second.id, first.id), false, "the responder does not");

  // What each of them was actually shown.
  const toFirst = to(sent, first);
  assert.match(textOf(toFirst), /mos tushdingiz/, "the first liker is told");
  assert.ok(
    toFirst.some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "and receives the card with the phone number on it"
  );

  const toSecond = to(sent, second);
  assert.match(textOf(toSecond), /mos tushdingiz/, "the responder is told too");
  assert.match(textOf(toSecond), /birinchi bo'lib yozishi mumkin/, "and told what that means for them");
  assert.ok(!gotContact(toSecond), "but is NOT shown the number");
  assert.match(textOf(toSecond), /Bu funksiya pullik/, "they are offered the unlock instead");
});

// The first liker holds the ONLY contact in the pair, so if they sit waiting
// for the other person, nothing happens at all. "It's a match" alone left
// both of them waiting; the message has to say whose move it is.
test("the first liker is told the other person is waiting on them", async () => {
  const first = user("Mover");
  const second = user("Waiter");
  await register(first, { gender: "male", name: "Mover" });
  await register(second, { gender: "female", name: "Waiter" });

  await likeFrom(first, "Waiter");
  const sent = await likeFrom(second, "Mover");
  const text = textOf(to(sent, first));

  assert.match(text, /mos tushdingiz/, "it is still a match message");
  assert.match(text, /kutmoqda/, "and says the other person is waiting");
  assert.match(text, /siz yozasiz/, "and that they are the one who writes");
  assert.match(text, /Waiter/, "naming who they matched with");
});

// Both match messages are HTML and both put a name the person typed
// themselves inside it. Unescaped, a name with < or & is read as a broken tag
// and Telegram refuses the message -- so the one piece of news either of them
// was waiting for never arrives at all.
test("a name containing HTML does not swallow the match message", async () => {
  const awkward = user("Tricky");
  const other = user("Plain");
  await register(awkward, { gender: "male", name: "Zed<b>&X" });
  await register(other, { gender: "female", name: "Plain" });

  await likeFrom(awkward, "Plain");
  // Searched by the plain part: the card's caption is escaped too, so the
  // raw name never appears in it verbatim.
  const sent = await likeFrom(other, "Zed");

  // Both sides must have heard something.
  assert.match(textOf(to(sent, awkward)), /mos tushdingiz/, "the first liker was told");
  assert.match(textOf(to(sent, other)), /mos tushdingiz/, "and so was the responder");

  // And the name arrived as text, not as markup.
  assert.match(textOf(to(sent, other)), /Zed&lt;b&gt;&amp;X/, "the name is escaped, not rendered");
});

// --- the likes list shows what each side actually has -------------------------
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

// The line the whole change depends on: answering a like opens that person,
// and ONLY that person. A stranger nobody has matched with stays shut.
// Being granted one person's contact must not open anybody else's.
test("a match opens only the person matched with, not everyone", async () => {
  const me = user("Mine");
  const partner = user("Partner");
  const stranger = user("Stranger");
  await register(me, { gender: "male", name: "Mine" });
  await register(partner, { gender: "female", name: "Partner" });
  await register(stranger, { gender: "female", name: "Stranger" });

  // me likes first, partner answers -- so me is the one who gets access.
  await likeFrom(me, "Partner");
  await likeFrom(partner, "Mine");

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

// The responder is not shut out -- they are asked to pay, or to earn it. A
// referral credit is the free route, and it has to actually work.
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
// The backfill predates the one-sided rule and grants both directions for
// pairs that matched under the OLD behaviour. Those two people already had
// each other's number; taking it back retroactively would be the app removing
// something a person was given, which is worse than the inconsistency.
test("pairs that matched under the old rule keep their access", async () => {
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
