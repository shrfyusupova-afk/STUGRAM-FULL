// Payme (Paycom) Merchant API -- protocol correctness and payment security.
//
// The controls, in the order a request meets them:
//   1. HTTP Basic auth with the merchant key, compared in constant time
//   2. the order must exist, be unpaid, and the amount must match the price
//      the SERVER decided -- in TIYIN, which is where a factor-of-100 bug
//      would live
//   3. Payme's own transaction lifecycle (created -> performed / cancelled),
//      idempotent on every method because Payme retries all of them
//   4. delivery gated on the same atomic order transition Click uses, so one
//      purchase cannot be granted twice -- including across providers
const assert = require("assert");
const fs = require("fs");
const path = require("path");

process.env.PAYME_MERCHANT_ID = "merchant123";
process.env.PAYME_KEY = "PAYME_TEST_KEY";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { createOrder, PREMIUM_PRICE_SOM, UNLOCK_PRICE_SOM } = require("../src/orders");
const payme = require("../src/payme");
const { ERROR, STATE, somToTiyin } = payme;

const BASE = "http://127.0.0.1:45999";
const M = () => h.mainBot();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let nextId = 920000;
let rpcId = 0;
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

const goodAuth = "Basic " + Buffer.from("Paycom:PAYME_TEST_KEY").toString("base64");

async function rpc(method, params, { auth = goodAuth } = {}) {
  const res = await fetch(BASE + "/payme", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return res.json();
}

const account = (orderId) => ({ order_id: orderId });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- 1. authentication -------------------------------------------------------

test("no credentials at all is refused", async () => {
  const res = await rpc("CheckPerformTransaction", { amount: 100, account: account("x") }, { auth: null });
  assert.strictEqual(res.error.code, ERROR.INSUFFICIENT_PRIVILEGE);
});

test("a wrong merchant key is refused", async () => {
  const bad = "Basic " + Buffer.from("Paycom:WRONG_KEY").toString("base64");
  const res = await rpc("CheckPerformTransaction", { amount: 100, account: account("x") }, { auth: bad });
  assert.strictEqual(res.error.code, ERROR.INSUFFICIENT_PRIVILEGE);
});

test("a key that is a PREFIX of the real one is refused", async () => {
  // Guards the length pre-check in the constant-time comparison.
  const bad = "Basic " + Buffer.from("Paycom:PAYME_TEST").toString("base64");
  const res = await rpc("CheckPerformTransaction", { amount: 100, account: account("x") }, { auth: bad });
  assert.strictEqual(res.error.code, ERROR.INSUFFICIENT_PRIVILEGE);
});

test("an unauthenticated caller cannot even discover whether an order exists", async () => {
  const u = user("Probe");
  await register(u, { gender: "male", name: "Probe" });
  const orderId = await createOrder(u.id, { type: "premium" });

  const res = await rpc("CheckPerformTransaction", { amount: somToTiyin(PREMIUM_PRICE_SOM), account: account(orderId) }, { auth: null });
  assert.strictEqual(res.error.code, ERROR.INSUFFICIENT_PRIVILEGE, "auth is checked before the order is looked at");
});

// --- 2. amount, in tiyin -----------------------------------------------------

test("the amount is checked in TIYIN against the server-side price", async () => {
  const u = user("Tiyin");
  await register(u, { gender: "male", name: "Tiyin" });
  const orderId = await createOrder(u.id, { type: "premium" });

  // The correct amount is the price x 100.
  const right = await rpc("CheckPerformTransaction", {
    amount: somToTiyin(PREMIUM_PRICE_SOM),
    account: account(orderId),
  });
  assert.strictEqual(right.result.allow, true, "the tiyin amount must be accepted");

  // Sending the SO'M figure is exactly the factor-of-100 mistake this guards.
  const asSom = await rpc("CheckPerformTransaction", { amount: PREMIUM_PRICE_SOM, account: account(orderId) });
  assert.strictEqual(asSom.error.code, ERROR.INVALID_AMOUNT, "so'm quoted as tiyin must be refused");
});

test("paying a premium order at the unlock price is refused", async () => {
  const u = user("Cheapskate");
  await register(u, { gender: "male", name: "Cheapskate" });
  const orderId = await createOrder(u.id, { type: "premium" });

  const res = await rpc("CheckPerformTransaction", {
    amount: somToTiyin(UNLOCK_PRICE_SOM),
    account: account(orderId),
  });
  assert.strictEqual(res.error.code, ERROR.INVALID_AMOUNT);
  assert.strictEqual(await db.hasPremium(u.id), false);
});

test("an order that does not exist is refused", async () => {
  const res = await rpc("CheckPerformTransaction", { amount: 100, account: account("premium_deadbeef") });
  assert.strictEqual(res.error.code, ERROR.ORDER_NOT_FOUND);
});

// --- 3. lifecycle ------------------------------------------------------------

test("the full happy path grants the feature exactly once", async () => {
  const u = user("Payer");
  await register(u, { gender: "male", name: "Payer" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);
  const txId = "payme_tx_happy";

  const created = await rpc("CreateTransaction", { id: txId, time: Date.now(), amount, account: account(orderId) });
  assert.strictEqual(created.result.state, STATE.CREATED);
  assert.strictEqual(created.result.transaction, txId);

  const performed = await rpc("PerformTransaction", { id: txId });
  assert.strictEqual(performed.result.state, STATE.PERFORMED);
  await wait(150);

  assert.strictEqual(await db.hasPremium(u.id), true, "the feature is granted");
  const until = (await db.getProfile(u.id)).premiumUntil;

  // Payme retries Perform. The retry must repeat the same answer, not grant
  // a second month.
  const again = await rpc("PerformTransaction", { id: txId });
  assert.strictEqual(again.result.state, STATE.PERFORMED);
  assert.strictEqual(again.result.perform_time, performed.result.perform_time, "same perform_time is echoed back");
  await wait(150);
  assert.strictEqual((await db.getProfile(u.id)).premiumUntil, until, "and nothing is granted a second time");
});

test("CreateTransaction is idempotent -- a retry returns the same transaction", async () => {
  const u = user("Retrier");
  await register(u, { gender: "male", name: "Retrier" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);
  const txId = "payme_tx_retry";

  const first = await rpc("CreateTransaction", { id: txId, time: Date.now(), amount, account: account(orderId) });
  const second = await rpc("CreateTransaction", { id: txId, time: Date.now(), amount, account: account(orderId) });

  assert.strictEqual(second.result.transaction, first.result.transaction);
  assert.strictEqual(second.result.create_time, first.result.create_time, "the original create_time is preserved");
  assert.strictEqual(second.result.state, STATE.CREATED);
});

test("a second live transaction cannot be opened on the same order", async () => {
  // Without this, two checkouts on one order could both be performed and the
  // money taken twice for a single purchase.
  const u = user("Doubler");
  await register(u, { gender: "male", name: "Doubler" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);

  const first = await rpc("CreateTransaction", { id: "payme_tx_a", time: Date.now(), amount, account: account(orderId) });
  assert.strictEqual(first.result.state, STATE.CREATED);

  const second = await rpc("CreateTransaction", { id: "payme_tx_b", time: Date.now(), amount, account: account(orderId) });
  assert.ok(second.error, "a competing transaction on the same order must be refused");
  assert.strictEqual(second.error.code, ERROR.CANNOT_PERFORM);
});

test("an order already paid cannot start a new transaction", async () => {
  const u = user("Settled");
  await register(u, { gender: "male", name: "Settled" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);

  await rpc("CreateTransaction", { id: "payme_tx_paid", time: Date.now(), amount, account: account(orderId) });
  await rpc("PerformTransaction", { id: "payme_tx_paid" });
  await wait(150);

  const res = await rpc("CreateTransaction", { id: "payme_tx_paid2", time: Date.now(), amount, account: account(orderId) });
  assert.ok(res.error, "a paid order is not payable again");
  assert.strictEqual(res.error.code, ERROR.ORDER_ALREADY_PAID);
});

test("performing an unknown transaction is refused", async () => {
  const res = await rpc("PerformTransaction", { id: "never_created" });
  assert.strictEqual(res.error.code, ERROR.TRANSACTION_NOT_FOUND);
});

// --- 4. cancellation ---------------------------------------------------------

test("cancelling before perform reports state -1, and is idempotent", async () => {
  const u = user("Canceller");
  await register(u, { gender: "male", name: "Canceller" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);
  const txId = "payme_tx_cancel";

  await rpc("CreateTransaction", { id: txId, time: Date.now(), amount, account: account(orderId) });
  const cancelled = await rpc("CancelTransaction", { id: txId, reason: 3 });
  assert.strictEqual(cancelled.result.state, STATE.CANCELLED_BEFORE_PERFORM);

  const again = await rpc("CancelTransaction", { id: txId, reason: 3 });
  assert.strictEqual(again.result.state, STATE.CANCELLED_BEFORE_PERFORM);
  assert.strictEqual(again.result.cancel_time, cancelled.result.cancel_time, "the original cancel_time is kept");

  assert.strictEqual(await db.hasPremium(u.id), false, "nothing was ever granted");
});

test("cancelling AFTER perform reports state -2 (a reversal)", async () => {
  const u = user("Reverser");
  await register(u, { gender: "male", name: "Reverser" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);
  const txId = "payme_tx_reverse";

  await rpc("CreateTransaction", { id: txId, time: Date.now(), amount, account: account(orderId) });
  await rpc("PerformTransaction", { id: txId });
  await wait(150);

  const cancelled = await rpc("CancelTransaction", { id: txId, reason: 5 });
  assert.strictEqual(cancelled.result.state, STATE.CANCELLED_AFTER_PERFORM, "a reversal is -2, not -1");
});

// --- 5. reporting methods ----------------------------------------------------

test("CheckTransaction reports the real state", async () => {
  const u = user("Checker");
  await register(u, { gender: "male", name: "Checker" });
  const orderId = await createOrder(u.id, { type: "premium" });
  const amount = somToTiyin(PREMIUM_PRICE_SOM);
  const txId = "payme_tx_check";

  await rpc("CreateTransaction", { id: txId, time: Date.now(), amount, account: account(orderId) });
  const before = await rpc("CheckTransaction", { id: txId });
  assert.strictEqual(before.result.state, STATE.CREATED);
  assert.strictEqual(before.result.perform_time, 0);

  await rpc("PerformTransaction", { id: txId });
  const after = await rpc("CheckTransaction", { id: txId });
  assert.strictEqual(after.result.state, STATE.PERFORMED);
  assert.ok(after.result.perform_time > 0);
});

test("GetStatement lists transactions in the window, with amounts in tiyin", async () => {
  const from = Date.now() - 60 * 60 * 1000;
  const res = await rpc("GetStatement", { from, to: Date.now() + 60 * 1000 });
  assert.ok(Array.isArray(res.result.transactions));
  assert.ok(res.result.transactions.length > 0, "the transactions created above are in range");
  for (const tx of res.result.transactions) {
    assert.ok(Number.isFinite(tx.amount) && tx.amount > 0, "every amount is a real number of tiyin");
    assert.ok(tx.account.order_id, "and carries the order it settles");
  }
});

test("an unknown method is refused rather than silently accepted", async () => {
  const res = await rpc("DropAllTables", {});
  assert.strictEqual(res.error.code, ERROR.METHOD_NOT_FOUND);
});

// --- 6. cross-provider -------------------------------------------------------

test("a Click-paid order cannot then be paid again through Payme", async () => {
  // Both providers settle the SAME order ledger, so "already paid" has to
  // mean the same thing to both of them.
  const u = user("Crossed");
  await register(u, { gender: "male", name: "Crossed" });
  const orderId = await createOrder(u.id, { type: "premium" });

  // Settle it the way Click's callback does, straight through the ledger.
  const { markOrder } = require("../src/orders");
  await markOrder(orderId, "pending", "paid", {});

  const res = await rpc("CreateTransaction", {
    id: "payme_tx_cross",
    time: Date.now(),
    amount: somToTiyin(PREMIUM_PRICE_SOM),
    account: account(orderId),
  });
  assert.ok(res.error, "an order settled elsewhere must not be payable again");
  assert.strictEqual(res.error.code, ERROR.ORDER_ALREADY_PAID);
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
