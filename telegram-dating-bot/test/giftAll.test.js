// Giving something to every user at once.
//
// This is the most irreversible button in the panel: one tap writes an
// entitlement onto every profile in the database. So the flow is three
// deliberate steps -- pick the gift, write what to say, confirm -- and most
// of what is checked here is that nothing is granted until the last one, and
// that a stale button from an abandoned attempt cannot start it from the
// middle.
//
// The other half is the grant itself. A gift to a thousand people must be
// indistinguishable from a gift to one, which means topping somebody up has
// to ADD to whatever time they had left rather than resetting them to a flat
// "now + 30 days" -- a bulk update would silently shorten every subscription
// that had more than a month on it.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const floodGuard = require("../src/floodGuard");
const { PREMIUM_DAYS, ANON_GENDER_DAYS } = require("../src/click");
const { __test } = require("../src/adminBot");
const { giftAllMessage, GIFT_ALL_KINDS, GIFT_UNLOCK_CREDITS } = __test;

function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const M = () => h.mainBot();
const A = () => h.adminBot();
const DAY = 24 * 60 * 60 * 1000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let nextId = 860000;
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

const ADMIN_PIN = "13579";
async function loginAdmin(admin) {
  await h.send(A(), h.commandUpdate("/iamadmin", admin));
  for (const d of ADMIN_PIN) await h.send(A(), h.callbackUpdate(`admin:pin:${d}`, admin));
}

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");
const inline = (sent) => sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat());
const toUser = (sent, u) => sent.filter((c) => String(c.payload.chat_id) === String(u.id));

const GIFT_ALL = "🎁 Hammaga ehson";

// The whole flow, up to but NOT including the final confirmation.
async function compose(admin, kind, note) {
  await h.send(A(), h.textUpdate(GIFT_ALL, admin));
  await h.send(A(), h.callbackUpdate(`admin:giftall:kind:${kind}`, admin));
  return h.send(A(), h.textUpdate(note, admin));
}

// The gift runs in the background, unawaited, and its length grows with the
// number of registered users -- 50ms per person. Waiting a fixed delay would
// pass early in the file and quietly stop covering anything later on, so this
// waits for the run's own summary message instead.
async function settle({ expectRun = false } = {}) {
  const deadline = Date.now() + 15000;
  const from = h.calls.length;
  while (Date.now() < deadline) {
    await wait(50);
    const finished = h.calls
      .slice(from)
      .some((c) => /Ehson tarqatildi/.test(c.payload?.text || ""));
    if (finished) return true;
    // Nothing was started, so there is no summary coming -- give the
    // background work a moment and stop.
    if (!expectRun && Date.now() - (deadline - 15000) > 400) return false;
  }
  if (expectRun) throw new Error("the gift run never finished");
  return false;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists and is logged in", async () => {
  admin = user("Santa");
  await register(admin, { gender: "male", name: "Santa" });
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));
});

// --- the three steps ---------------------------------------------------------

test("the flow asks for the gift, then the note, then confirmation", async () => {
  const opened = await h.send(A(), h.textUpdate(GIFT_ALL, admin));
  const kinds = inline(opened).map((b) => b.callback_data);
  assert.ok(kinds.includes("admin:giftall:kind:premium"), "Premium is on offer");
  assert.ok(kinds.includes("admin:giftall:kind:credits"), "and a free profile unlock");
  assert.ok(kinds.includes("admin:giftall:kind:vip"), "and VIP chat");

  const picked = await h.send(A(), h.callbackUpdate("admin:giftall:kind:premium", admin));
  assert.match(said(picked), /izoh/, "then it asks what to say about it");

  const confirmed = await h.send(A(), h.textUpdate("Bayram muborak!", admin));
  const text = said(confirmed);
  assert.match(text, /Namuna/, "the exact message is previewed");
  assert.match(text, /Bayram muborak!/, "including the admin's own words");
  assert.match(text, /Tasdiqlaysizmi/, "and only then is confirmation asked");
  assert.match(text, /qaytarib bo'lmaydi/, "with a warning that it cannot be undone");

  const buttons = inline(confirmed).map((b) => b.callback_data);
  assert.ok(buttons.includes("admin:giftall:yes"), "a yes button");
  assert.ok(buttons.includes("admin:giftall:no"), "and a no button");

  await h.send(A(), h.callbackUpdate("admin:giftall:no", admin));
});

// The single most important case: nothing may be granted before the last tap.
test("nothing is granted until the final confirmation", async () => {
  const bystander = user("Bystander");
  await register(bystander, { gender: "female", name: "Bystander" });
  const before = await db.getUnlockCredits(bystander.id);

  await compose(admin, "credits", "Sinov uchun");
  await settle();

  assert.strictEqual(
    await db.getUnlockCredits(bystander.id),
    before,
    "composing a gift must not hand anything out"
  );

  // And saying no leaves it that way.
  const cancelled = await h.send(A(), h.callbackUpdate("admin:giftall:no", admin));
  await settle();
  assert.match(said(cancelled), /Bekor/, "cancelling says so");
  assert.strictEqual(await db.getUnlockCredits(bystander.id), before, "and still grants nothing");
});

// --- what actually arrives ---------------------------------------------------

test("confirming gives every user the gift, and tells them", async () => {
  const a = user("GetsA");
  const b = user("GetsB");
  await register(a, { gender: "male", name: "GetsA" });
  await register(b, { gender: "female", name: "GetsB" });
  const beforeA = await db.getUnlockCredits(a.id);

  await compose(admin, "credits", "Hammaga rahmat! 🎉");
  const sent = await h.send(A(), h.callbackUpdate("admin:giftall:yes", admin));
  assert.match(said(sent), /boshlandi/, "the admin is told it has started");
  await settle({ expectRun: true });

  assert.strictEqual(
    await db.getUnlockCredits(a.id),
    beforeA + GIFT_UNLOCK_CREDITS,
    "the gift really lands on a profile"
  );

  // And the recipients hear about it, in the admin's own words.
  const theirs = h.calls.filter((c) => String(c.payload.chat_id) === String(b.id));
  const text = theirs.map((c) => c.payload.text || "").join("\n");
  assert.match(text, /Sizga sovg'a/, "the message announces a gift");
  assert.match(text, /Hammaga rahmat!/, "carries the note the admin wrote");
  assert.match(text, /anketa ochish/, "and says exactly what was given");
});

// Topping up must ADD to what somebody already has. A bulk "everyone gets
// now + 30 days" would silently shorten every longer subscription.
test("gifting Premium extends what is left instead of replacing it", async () => {
  const rich = user("AlreadyPaid");
  await register(rich, { gender: "male", name: "AlreadyPaid" });

  // 50 days already on the clock -- more than the gift itself.
  const start = new Date(Date.now() + 50 * DAY).toISOString();
  await db.setPremiumUntil(rich.id, start);

  await compose(admin, "premium", "Sovg'a");
  await h.send(A(), h.callbackUpdate("admin:giftall:yes", admin));
  await settle({ expectRun: true });

  const after = new Date((await db.getProfile(rich.id)).premiumUntil).getTime();
  const addedDays = (after - new Date(start).getTime()) / DAY;
  assert.ok(
    Math.abs(addedDays - PREMIUM_DAYS) < 1,
    `expected ${PREMIUM_DAYS} days added to the existing 50, got ${addedDays.toFixed(1)}`
  );
});

test("gifting VIP really opens the chat for everyone", async () => {
  const plain = user("NoVipYet");
  await register(plain, { gender: "male", name: "NoVipYet" });
  assert.strictEqual(await db.hasVipChat(plain.id), false);

  await compose(admin, "vip", "VIP hammaga ochiq!");
  await h.send(A(), h.callbackUpdate("admin:giftall:yes", admin));
  await settle({ expectRun: true });

  assert.strictEqual(await db.hasVipChat(plain.id), true, "the grant is recorded");
});

test("gifting the anonymous filter grants the right number of days", async () => {
  const u = user("AnonGift");
  await register(u, { gender: "male", name: "AnonGift" });

  await compose(admin, "anon", "Sinab ko'ring");
  await h.send(A(), h.callbackUpdate("admin:giftall:yes", admin));
  await settle({ expectRun: true });

  const until = (await db.getProfile(u.id)).anonGenderUntil;
  assert.ok(until, "an expiry is set");
  const days = (new Date(until).getTime() - Date.now()) / DAY;
  assert.ok(Math.abs(days - ANON_GENDER_DAYS) < 1, `expected ${ANON_GENDER_DAYS} days, got ${days.toFixed(1)}`);
});

// --- the ways it could go wrong ----------------------------------------------

// The buttons sit on a message that stays in the chat. Tapping an old one
// long after the flow was abandoned must not start a half-built gift.
test("a stale button says so instead of granting something half-formed", async () => {
  const victim = user("Untouched");
  await register(victim, { gender: "male", name: "Untouched" });
  const before = await db.getUnlockCredits(victim.id);

  // No flow in progress at all.
  const stale = await h.send(A(), h.callbackUpdate("admin:giftall:yes", admin));
  await settle();
  assert.match(said(stale), /eskirgan/, "it must say the button is stale");
  assert.strictEqual(await db.getUnlockCredits(victim.id), before, "and grant nothing");

  const staleKind = await h.send(A(), h.callbackUpdate("admin:giftall:kind:premium", admin));
  assert.match(said(staleKind), /eskirgan/, "the same for a stale gift-kind button");
});

// A note containing < or & would otherwise be read as a broken HTML tag and
// Telegram would refuse EVERY delivery -- a gift nobody hears about.
test("a note with HTML in it still reaches people", async () => {
  const u = user("HtmlNote");
  await register(u, { gender: "female", name: "HtmlNote" });

  await compose(admin, "credits", "Narx <100 ming & tekin!");
  await h.send(A(), h.callbackUpdate("admin:giftall:yes", admin));
  await settle({ expectRun: true });

  const theirs = h.calls.filter((c) => String(c.payload.chat_id) === String(u.id));
  const text = theirs.map((c) => c.payload.text || "").join("\n");
  assert.match(text, /Sizga sovg'a/, "the message arrived");
  assert.match(text, /&lt;100 ming &amp; tekin/, "with the note escaped, not rendered as markup");
});

// The message is the only thing recipients see, so it has to carry both the
// admin's words and what they actually got.
test("the recipient message names the gift as well as the note", () => {
  for (const kind of Object.keys(GIFT_ALL_KINDS)) {
    const text = giftAllMessage(kind, "Izoh matni");
    assert.match(text, /Izoh matni/, `${kind}: the note`);
    assert.match(text, /Nima berildi/, `${kind}: and what was given`);
    assert.ok(text.length > 40, `${kind}: not an empty shell`);
  }
});

// This hands out paid features to the entire user base. It is not something
// a logged-out person may reach by typing a label or replaying a callback.
test("a non-admin can neither open it nor confirm it", async () => {
  const outsider = user("Greedy");
  await register(outsider, { gender: "male", name: "Greedy" });
  const before = await db.getUnlockCredits(outsider.id);

  const opened = await h.send(A(), h.textUpdate(GIFT_ALL, outsider));
  assert.ok(!/Hammaga ehson/.test(said(opened)), "the screen must not open");

  await h.send(A(), h.callbackUpdate("admin:giftall:kind:premium", outsider));
  await h.send(A(), h.callbackUpdate("admin:giftall:yes", outsider));
  await settle();
  assert.strictEqual(await db.getUnlockCredits(outsider.id), before, "and nothing may be granted");
  assert.strictEqual(await db.hasPremium(outsider.id), false);
});

// --- go ----------------------------------------------------------------------
(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      resetFloodGuard();
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
