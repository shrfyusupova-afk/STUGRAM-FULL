// The "subscribe to our channel" gate.
//
// The three rules this file exists to hold in place:
//   1. NEVER block on failure. If membership cannot be determined -- the bot
//      is not a channel admin, Telegram is down, the API returns an
//      unexpected shape -- the person goes through. A gate that fails closed
//      takes the whole product offline over a config mistake.
//   2. Somebody already subscribed never sees it.
//   3. A like is recorded BEFORE the gate is consulted, so asking for a
//      subscription never costs a user the decision they just made.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const ROOT = path.join(__dirname, "..");
const Telegram = require(path.join(ROOT, "node_modules/telegraf/lib/telegram.js")).default;

const h = require("./harness");
const db = require("../src/db");
const gate = require("../src/channelGate");

const M = () => h.mainBot();

let nextId = 950000;
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

const to = (sent, u) => sent.filter((c) => String(c.payload.chat_id) === String(u.id));
const textOf = (sent, u) => to(sent, u).map((c) => c.payload.text || c.payload.caption || "").join("\n");
const cards = (sent, u) => to(sent, u).filter((c) => c.method === "sendPhoto");
const buttons = (sent, u) =>
  to(sent, u).flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat());

// Puts somebody in front of a candidate, ready to press ❤️.
async function browseTo(viewer, name, limit = 25) {
  let sent = await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", viewer));
  for (let i = 0; i < limit; i++) {
    const card = sent.find((c) => c.method === "sendPhoto");
    if (card && (card.payload.caption || "").includes(name)) return card;
    sent = await h.send(M(), h.textUpdate("👎", viewer));
  }
  throw new Error(`never saw ${name}`);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- rule 2: invisible to subscribers ----------------------------------------

test("a subscriber never sees the gate at all", async () => {
  const u = user("Member");
  const target = user("Girl1");
  await register(u, { gender: "male", name: "Member" });
  await register(target, { gender: "female", name: "Girl1" });

  await browseTo(u, "Girl1");
  const liked = await h.send(M(), h.textUpdate("❤️", u));

  assert.ok(!/kanal/i.test(textOf(liked, u)), "no gate for somebody already subscribed");
  assert.ok(cards(liked, u).length > 0 || /nomzod/i.test(textOf(liked, u)), "browsing simply continues");
});

test("...and the invitation after registration is skipped for them too", async () => {
  const u = user("AlreadyIn");
  const done = await register(u, { gender: "male", name: "AlreadyIn" });
  assert.ok(!/kanalga qo'shiling/i.test(textOf(done, u)), "a subscriber is not pitched the channel");
});

// --- rule 3: the like is never lost -------------------------------------------

test("the gate appears after a like -- and the like is still recorded", async () => {
  const u = user("Outsider");
  const target = user("Girl2");
  await register(u, { gender: "male", name: "Outsider" });
  await register(target, { gender: "female", name: "Girl2" });

  await browseTo(u, "Girl2");
  h.notSubscribed.add(String(u.id));
  gate.forget(u.id);

  const liked = await h.send(M(), h.textUpdate("❤️", u));

  assert.match(textOf(liked, u), /kanal/i, "the gate is shown");
  assert.strictEqual(
    await db.hasLiked(u.id, target.id),
    true,
    "the like must be stored BEFORE the gate -- subscribing cannot cost a decision"
  );
  assert.strictEqual(cards(liked, u).length, 0, "and no next profile until they subscribe");

  h.notSubscribed.delete(String(u.id));
  gate.forget(u.id);
});

test("the gate offers a link AND a check button", async () => {
  const u = user("Checker");
  const target = user("Girl3");
  await register(u, { gender: "male", name: "Checker" });
  await register(target, { gender: "female", name: "Girl3" });

  await browseTo(u, "Girl3");
  h.notSubscribed.add(String(u.id));
  gate.forget(u.id);
  const liked = await h.send(M(), h.textUpdate("❤️", u));

  const btns = buttons(liked, u);
  assert.ok(btns.some((b) => String(b.url || "").includes("t.me/")), "a link into the channel");
  assert.ok(btns.some((b) => b.callback_data === "gate:check:discover"), "a check button that knows what to resume");

  h.notSubscribed.delete(String(u.id));
  gate.forget(u.id);
});

// --- resuming ------------------------------------------------------------------

test("tapping check while still not subscribed does not let them past", async () => {
  const u = user("Faker");
  await register(u, { gender: "male", name: "Faker" });
  h.notSubscribed.add(String(u.id));
  gate.forget(u.id);

  const checked = await h.send(M(), h.callbackUpdate("gate:check:discover", u));
  assert.strictEqual(cards(checked, u).length, 0, "no profile is handed over");

  h.notSubscribed.delete(String(u.id));
  gate.forget(u.id);
});

test("once subscribed, the check button resumes browsing by itself", async () => {
  const u = user("Joiner");
  const target = user("Girl4");
  await register(u, { gender: "male", name: "Joiner" });
  await register(target, { gender: "female", name: "Girl4" });

  // They subscribe between being shown the gate and tapping check.
  h.notSubscribed.add(String(u.id));
  gate.forget(u.id);
  await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", u));
  h.notSubscribed.delete(String(u.id));
  gate.forget(u.id);

  const resumed = await h.send(M(), h.callbackUpdate("gate:check:discover", u));
  assert.ok(cards(resumed, u).length > 0, "the next profile appears without another tap");
});

// --- anonymous chat -------------------------------------------------------------

test("random anon chat is gated BEFORE the search starts", async () => {
  const u = user("AnonSeeker");
  await register(u, { gender: "male", name: "AnonSeeker" });
  h.notSubscribed.add(String(u.id));
  gate.forget(u.id);

  await h.send(M(), h.textUpdate("🕵️ Anonim chat", u));
  const started = await h.send(M(), h.textUpdate("🎲 Random", u));

  const text = textOf(started, u);
  assert.match(text, /kanal/i, "the gate stands in front of the feature");
  assert.ok(!/qidirilmoqda|kutilmoqda/i.test(text), "and the search never began");

  h.notSubscribed.delete(String(u.id));
  gate.forget(u.id);
});

// --- rule 1: never block on failure ---------------------------------------------

test("a failing membership check lets the person through", async () => {
  const original = Telegram.prototype.callApi;
  Telegram.prototype.callApi = async function (method, payload = {}) {
    if (method === "getChatMember") throw new Error("Bad Request: chat not found");
    return original.call(this, method, payload);
  };
  try {
    gate.forget(999001);
    assert.strictEqual(
      await gate.isSubscribed({ getChatMember: () => Promise.reject(new Error("chat not found")) }, 999001),
      true,
      "an unanswerable check must never lock somebody out"
    );
  } finally {
    Telegram.prototype.callApi = original;
  }
});

test("an unrecognisable API response also lets the person through", async () => {
  // Not an error -- a call that succeeds and returns something unexpected.
  // "We cannot tell" has to resolve the same way an outright failure does.
  gate.forget(999002);
  const weird = { getChatMember: async () => true };
  assert.strictEqual(await gate.isSubscribed(weird, 999002), true);

  gate.forget(999003);
  const empty = { getChatMember: async () => ({}) };
  assert.strictEqual(await gate.isSubscribed(empty, 999003), true);
});

test("admins and creators of the channel count as subscribed", async () => {
  for (const status of ["member", "administrator", "creator"]) {
    gate.forget(999010);
    const fake = { getChatMember: async () => ({ status }) };
    assert.strictEqual(await gate.isSubscribed(fake, 999010), true, `${status} counts`);
  }
  for (const status of ["left", "kicked"]) {
    gate.forget(999011);
    const fake = { getChatMember: async () => ({ status }) };
    assert.strictEqual(await gate.isSubscribed(fake, 999011), false, `${status} does not`);
  }
});

// --- configuration ---------------------------------------------------------------

test("the channel name is understood however it is written", async () => {
  const { normaliseUsername } = gate.__test;
  for (const raw of ["foroneforever", "@foroneforever", "https://t.me/foroneforever", " @foroneforever "]) {
    assert.strictEqual(normaliseUsername(raw), "foroneforever", `"${raw}"`);
  }
  assert.strictEqual(normaliseUsername(""), null);
  assert.strictEqual(normaliseUsername("a b c"), null);
});

test("the membership cache hands its memory back", async () => {
  const { cache, sweepCache } = gate.__test;
  cache.set(111, { subscribed: true, expiresAt: Date.now() - 1000 });
  cache.set(222, { subscribed: true, expiresAt: Date.now() + 60000 });
  sweepCache();
  assert.ok(!cache.has(111), "an expired entry is dropped");
  assert.ok(cache.has(222), "a live one is kept");
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
