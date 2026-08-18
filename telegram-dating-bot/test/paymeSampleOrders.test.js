// The two order ids Payme asks for before they switch a merchant on.
//
// Their integration team says "ID и сумму по 2 заказам" and then runs their
// own test suite against our Merchant API using exactly those ids. That makes
// three things load-bearing, and each has its own way of costing a week:
//
//   * the ids must be real orders this bot created -- an invented one is
//     rejected by our own CheckPerformTransaction, which reads to Payme as
//     "your API is broken"
//   * they must still be UNPAID -- a paid order is refused by design, and
//     that refusal is indistinguishable, from their side, from a bug
//   * the amount must be quoted in TIYIN as well as so'm, because that is
//     what their request will carry and the single most common thing to get
//     wrong (1 so'm = 100 tiyin)
//
// And repeating the command has to give the same two ids back, or an id
// already sent to Payme goes stale the moment somebody taps it again.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const floodGuard = require("../src/floodGuard");
const { getOrder, PREMIUM_PRICE_SOM, ANON_GENDER_PRICE_SOM } = require("../src/orders");
const { __test } = require("../src/adminBot");
const { paymeSampleReport, paymeSamplePaste, PAYME_SAMPLE_TYPES, ORDER_ID_RE } = __test;

function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const M = () => h.mainBot();
const A = () => h.adminBot();

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

// Every order id the reply mentions, in the order it mentions them.
const idsIn = (text) => text.match(/(premium|unlock|vipchat|anongender)_[0-9a-f]{16,32}/g) || [];

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists and is logged in", async () => {
  admin = user("PaymeBoss");
  await register(admin, { gender: "male", name: "PaymeBoss" });
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));
});

// --- the ids themselves ------------------------------------------------------

test("the command answers with two order ids", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  const ids = [...new Set(idsIn(text))];
  assert.strictEqual(ids.length, 2, `expected two distinct ids, got ${ids.length}: ${ids}`);
  for (const id of ids) assert.match(id, ORDER_ID_RE, `${id} is not a well-formed order id`);
});

test("both ids are real orders in the ledger, not invented", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  for (const id of [...new Set(idsIn(text))]) {
    const order = await getOrder(id);
    assert.ok(order, `${id} is not in the ledger -- Payme's suite would be rejected`);
    assert.strictEqual(String(order.userId), String(admin.id));
  }
});

// The whole point of handing Payme an id is that their CheckPerformTransaction
// call against it succeeds. Ours refuses an order that is already settled, so
// a paid id would fail their suite in a way that looks like our bug.
test("both orders are left unpaid, which is what Payme tests against", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  for (const id of [...new Set(idsIn(text))]) {
    const order = await getOrder(id);
    assert.strictEqual(order.status, "pending", `${id} must still be pending, not ${order.status}`);
  }
});

test("the two orders are different products, so the amount is actually exercised", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  const types = [...new Set(idsIn(text))].map((id) => id.split("_")[0]);
  assert.deepStrictEqual(types.sort(), [...PAYME_SAMPLE_TYPES].sort());
});

// Two ids already sent to Payme must not be replaced by two new ones the next
// time somebody runs the command -- their suite would then be testing orders
// nobody quoted them.
test("running it again returns the same two ids", async () => {
  const first = [...new Set(idsIn(said(await h.send(A(), h.commandUpdate("/testorders", admin)))))];
  const second = [...new Set(idsIn(said(await h.send(A(), h.commandUpdate("/testorders", admin)))))];
  assert.deepStrictEqual(second.sort(), first.sort());
});

// --- the amounts -------------------------------------------------------------

test("each amount is shown in so'm AND in tiyin", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  assert.ok(text.includes(String(PREMIUM_PRICE_SOM * 100)), "premium tiyin amount is missing");
  assert.ok(text.includes(String(ANON_GENDER_PRICE_SOM * 100)), "anon-gender tiyin amount is missing");
  assert.match(text, /tiyin/i, "the unit must be named, or the number is ambiguous");
});

test("the tiyin figure is exactly the so'm figure times a hundred", () => {
  const entries = [
    { type: "premium", orderId: "premium_" + "a".repeat(24), amount: 79900, tiyin: 7990000 },
    { type: "anongender", orderId: "anongender_" + "b".repeat(24), amount: 12900, tiyin: 1290000 },
  ];
  const report = paymeSampleReport(entries);
  for (const entry of entries) {
    assert.strictEqual(entry.tiyin, entry.amount * 100);
    assert.ok(report.includes(String(entry.tiyin)), `${entry.tiyin} is missing from the report`);
  }
});

test("the tiyin amount matches what the ledger stores for that order", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  for (const id of [...new Set(idsIn(text))]) {
    const order = await getOrder(id);
    assert.ok(
      text.includes(String(order.amount * 100)),
      `the reply must quote ${order.amount * 100} tiyin for ${id}`
    );
  }
});

// --- the paste block ---------------------------------------------------------

// What actually gets sent to Payme is a copied block of text, so it has to
// carry both facts for both orders and name the account field they expect.
test("the copy block names the account field, both ids and both amounts", () => {
  const entries = [
    { type: "premium", orderId: "premium_" + "c".repeat(24), amount: 79900, tiyin: 7990000 },
    { type: "anongender", orderId: "anongender_" + "d".repeat(24), amount: 12900, tiyin: 1290000 },
  ];
  const paste = paymeSamplePaste(entries);
  for (const entry of entries) {
    assert.ok(paste.includes(entry.orderId), `${entry.orderId} missing`);
    assert.ok(paste.includes(String(entry.amount)), `${entry.amount} missing`);
    assert.ok(paste.includes(String(entry.tiyin)), `${entry.tiyin} missing`);
  }
  assert.match(paste, /order_id/, "the account field Payme sends must be named");
});

test("the reply warns that these orders must not be paid", async () => {
  const text = said(await h.send(A(), h.commandUpdate("/testorders", admin)));
  assert.match(text, /to'lamang|to'lanmagan/i, "it must say to leave them unpaid");
});

// --- who may run it ----------------------------------------------------------

// The reply carries live order ids for a payment provider. A stranger who
// learns one can aim their own checkout at it.
test("a non-admin gets nothing at all", async () => {
  const outsider = user("Nosy");
  await register(outsider, { gender: "male", name: "Nosy" });
  const text = said(await h.send(A(), h.commandUpdate("/testorders", outsider)));
  assert.strictEqual(idsIn(text).length, 0, "no order id may leak to a non-admin");
  assert.ok(!/Payme uchun/.test(text), "and the screen must not open");
});

// An admin whose 12-hour session has lapsed is a logged-out admin. Same rule
// as every other admin screen: re-enter the PIN first.
test("an admin with an expired session is asked for the PIN instead", async () => {
  const stale = user("Lapsed");
  await register(stale, { gender: "male", name: "Lapsed" });
  await db.addAdmin(stale.id);
  const text = said(await h.send(A(), h.commandUpdate("/testorders", stale)));
  assert.strictEqual(idsIn(text).length, 0, "no order id before the PIN");
  assert.match(text, /kod/i, "it must ask for the code");
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
