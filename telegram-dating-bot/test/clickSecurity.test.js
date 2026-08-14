// Payment-path security, written to be read by someone auditing this
// integration rather than only by someone maintaining it.
//
// The controls that actually protect money here, in the order a request
// meets them:
//   1. signature (HMAC-less MD5 per Click's spec) over every field that
//      matters, compared in constant time
//   2. envelope: the callback must be for THIS service_id and carry the
//      action belonging to the endpoint it arrived at
//   3. amount: compared against a price the SERVER decided, never one the
//      client supplied
//   4. idempotency: delivery is gated on an atomic status transition, so a
//      replay can never pay out twice
//   5. abuse: unauthenticated floods are cut off before they cost a hash
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

process.env.CLICK_MERCHANT_ID = "1111";
process.env.CLICK_SERVICE_ID = "2222";
process.env.CLICK_SECRET_KEY = "TOPSECRET";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { createOrder, UNLOCK_PRICE_SOM, PREMIUM_PRICE_SOM } = require("../src/click");

const BASE = "http://127.0.0.1:45999";
const M = () => h.mainBot();
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let nextId = 940000;
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

async function clickPost(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return { status: res.status, body: await res.json() };
}

const SIGN_TIME = "2026-08-11 10:00:00";
const prepareSign = (o) => md5(`${o.click_trans_id}${o.service_id}TOPSECRET${o.merchant_trans_id}${o.amount}${o.action}${o.sign_time}`);
const completeSign = (o) =>
  md5(`${o.click_trans_id}${o.service_id}TOPSECRET${o.merchant_trans_id}${o.merchant_prepare_id}${o.amount}${o.action}${o.sign_time}`);

// A correctly-signed Prepare for a real, freshly created order.
async function freshOrder(u, type = "premium", targetId) {
  const orderId = await createOrder(u.id, { type, targetId });
  return orderId;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- 1. the amount is the server's, never the caller's ------------------------

test("the price comes from the server -- a caller cannot name their own", async () => {
  const u = user("Cheap");
  await register(u, { gender: "male", name: "Cheap" });

  // Premium costs PREMIUM_PRICE_SOM. Try to settle it for the unlock price.
  const orderId = await freshOrder(u, "premium");
  const body = {
    click_trans_id: "701",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(UNLOCK_PRICE_SOM), // far less than premium
    action: "0",
    sign_time: SIGN_TIME,
  };
  const res = await clickPost("/click/prepare", { ...body, sign_string: prepareSign(body) });

  assert.strictEqual(res.body.error, -2, "an underpaid order must be refused with AMOUNT_MISMATCH");
  assert.strictEqual(await db.hasPremium(u.id), false, "and must grant nothing");
});

test("the stored order amount is the constant, not anything a client sent", async () => {
  const u = user("Honest");
  await register(u, { gender: "male", name: "Honest" });
  const orderId = await freshOrder(u, "premium");

  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "clickTransactions.json"), "utf8"));
  assert.strictEqual(raw[orderId].amount, PREMIUM_PRICE_SOM, "the order carries the server-side price");
});

// --- 2. signature ------------------------------------------------------------

test("a forged signature is refused on both endpoints", async () => {
  const u = user("Forger");
  await register(u, { gender: "male", name: "Forger" });
  const orderId = await freshOrder(u, "premium");

  const common = {
    click_trans_id: "702",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    sign_time: SIGN_TIME,
  };

  const p = await clickPost("/click/prepare", { ...common, action: "0", sign_string: md5("nonsense") });
  assert.strictEqual(p.body.error, -1);

  const c = await clickPost("/click/complete", {
    ...common, action: "1", merchant_prepare_id: orderId, sign_string: md5("nonsense"),
  });
  assert.strictEqual(c.body.error, -1);
  assert.strictEqual(await db.hasPremium(u.id), false, "nothing is granted without a valid signature");
});

test("a Prepare signature cannot be replayed against Complete", async () => {
  const u = user("Crosser");
  await register(u, { gender: "male", name: "Crosser" });
  const orderId = await freshOrder(u, "premium");

  const body = {
    click_trans_id: "703",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    action: "0",
    sign_time: SIGN_TIME,
  };
  const sig = prepareSign(body);

  // Same signature, same fields, aimed at the endpoint that pays out.
  const res = await clickPost("/click/complete", { ...body, merchant_prepare_id: orderId, sign_string: sig });
  assert.strictEqual(res.body.error, -1, "the two endpoints sign different strings, so this cannot validate");
  assert.strictEqual(await db.hasPremium(u.id), false);
});

// --- 3. envelope: right merchant, right endpoint ------------------------------

test("a correctly-signed callback for a DIFFERENT service_id is refused", async () => {
  const u = user("Other");
  await register(u, { gender: "male", name: "Other" });
  const orderId = await freshOrder(u, "premium");

  // Signed correctly -- but for service 9999, not ours.
  const body = {
    click_trans_id: "704",
    service_id: "9999",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    action: "0",
    sign_time: SIGN_TIME,
  };
  const res = await clickPost("/click/prepare", { ...body, sign_string: prepareSign(body) });

  assert.strictEqual(res.body.error, -1, "a callback for another service must not be honoured");
  assert.strictEqual(await db.hasPremium(u.id), false);
});

test("a callback carrying the wrong action for its endpoint is refused", async () => {
  const u = user("Mixed");
  await register(u, { gender: "male", name: "Mixed" });
  const orderId = await freshOrder(u, "premium");

  // action=1 (Complete) arriving at /click/prepare, signed correctly for it.
  const body = {
    click_trans_id: "705",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    action: "1",
    sign_time: SIGN_TIME,
  };
  const res = await clickPost("/click/prepare", { ...body, sign_string: prepareSign(body) });
  assert.strictEqual(res.body.error, -1, "prepare must only accept action=0");
});

// --- 4. idempotency ----------------------------------------------------------

test("a replayed Complete never pays out twice", async () => {
  const u = user("Replayer");
  await register(u, { gender: "male", name: "Replayer" });
  const orderId = await freshOrder(u, "premium");

  const common = {
    click_trans_id: "706",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    sign_time: SIGN_TIME,
  };
  const p = { ...common, action: "0" };
  await clickPost("/click/prepare", { ...p, sign_string: prepareSign(p) });

  const c = { ...common, action: "1", merchant_prepare_id: orderId };
  const first = await clickPost("/click/complete", { ...c, sign_string: completeSign(c) });
  assert.strictEqual(first.body.error, 0, "the genuine payment goes through");
  await wait(150);

  const until = (await db.getProfile(u.id)).premiumUntil;
  assert.ok(until, "premium is on");

  // Byte-identical replay, exactly as a network retry or a captured request.
  const second = await clickPost("/click/complete", { ...c, sign_string: completeSign(c) });
  assert.strictEqual(second.body.error, -4, "the replay is answered ALREADY PAID");
  await wait(150);

  assert.strictEqual(
    (await db.getProfile(u.id)).premiumUntil,
    until,
    "and must not extend the subscription a second time"
  );
});

// --- 5. abuse control --------------------------------------------------------

test("an unauthenticated flood is cut off, and valid traffic is never throttled", async () => {
  const junk = {
    click_trans_id: "707",
    service_id: "2222",
    merchant_trans_id: "does_not_exist",
    amount: "1",
    action: "0",
    sign_time: SIGN_TIME,
    sign_string: md5("wrong"),
  };

  let sawThrottle = false;
  for (let i = 0; i < 40; i++) {
    const res = await clickPost("/click/prepare", junk);
    if (res.status === 429) {
      sawThrottle = true;
      break;
    }
  }
  assert.ok(sawThrottle, "a sustained bad-signature flood must eventually be refused outright");

  // The counter is fed ONLY by failed signatures, so this is the property
  // that makes it safe to run on a money path at all: even mid-flood, a
  // genuine Click callback still has to be honoured. (Same source IP here,
  // which is the strictest version of the check.)
  const u = user("Legit");
  await register(u, { gender: "male", name: "Legit" });
  const orderId = await freshOrder(u, "premium");
  const body = {
    click_trans_id: "708",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    action: "0",
    sign_time: SIGN_TIME,
  };
  const good = await clickPost("/click/prepare", { ...body, sign_string: prepareSign(body) });
  assert.strictEqual(good.status, 200, "a correctly signed callback is never rate limited");
  assert.strictEqual(good.body.error, 0, "and is processed normally");
});

// --- 6. order identifiers ----------------------------------------------------

test("order ids are unguessable and carry no user data", async () => {
  const u = user("Private");
  await register(u, { gender: "male", name: "Private" });

  const a = await freshOrder(u, "premium");
  assert.ok(
    !a.includes(String(u.id)),
    `an order id must not embed the user's Telegram id: ${a}`
  );

  // Two different people's orders must share no predictable structure.
  const v = user("Private2");
  await register(v, { gender: "male", name: "Private2" });
  const b = await freshOrder(v, "premium");
  assert.notStrictEqual(a, b);
  assert.ok(/^premium_[0-9a-f]{24}$/.test(a), `unexpected id shape: ${a}`);
});

test("a stranger cannot settle an order by guessing its id", async () => {
  // The whole point of the signature: even a perfectly formed request for a
  // real order does nothing without the secret.
  const u = user("Victim");
  await register(u, { gender: "male", name: "Victim" });
  const orderId = await freshOrder(u, "premium");

  const body = {
    click_trans_id: "709",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(PREMIUM_PRICE_SOM),
    action: "1",
    merchant_prepare_id: orderId,
    sign_time: SIGN_TIME,
  };
  // Signed with the wrong key -- i.e. what any outsider can actually produce.
  const wrongKey = md5(
    `${body.click_trans_id}${body.service_id}GUESSED${body.merchant_trans_id}${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`
  );
  const res = await clickPost("/click/complete", { ...body, sign_string: wrongKey });

  assert.strictEqual(res.body.error, -1);
  assert.strictEqual(await db.hasPremium(u.id), false, "knowing the order id alone buys nothing");
});

// --- 7. configuration mistakes are caught at startup, not at first payment ----

test("a merchant id with anything but digits is reported, not silently shipped", () => {
  const { clickConfigProblem } = require("../src/click");
  const before = process.env.CLICK_MERCHANT_ID;
  try {
    // The real mistake this catches: the Click cabinet shows the merchant id
    // next to the merchant's phone, and pasting both produces a checkout that
    // loads and then says "Postavshchik ne nayden" -- invisible from the bot,
    // found only by the first person who tries to pay.
    process.env.CLICK_MERCHANT_ID = "63267_998909453305";
    const problem = clickConfigProblem();
    assert.ok(problem, "a non-numeric merchant id must be reported");
    assert.match(problem, /CLICK_MERCHANT_ID/);

    process.env.CLICK_MERCHANT_ID = "63267";
    assert.strictEqual(clickConfigProblem(), null, "a clean numeric id is fine");
  } finally {
    process.env.CLICK_MERCHANT_ID = before;
  }
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
