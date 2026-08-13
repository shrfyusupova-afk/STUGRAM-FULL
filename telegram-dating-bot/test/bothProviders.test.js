// Wherever there is a Click button there must be a Payme button.
//
// This is the property that is easy to state and easy to break: five
// different screens open a checkout, and any one of them could quietly be
// left behind when a provider is added. So rather than testing each screen's
// wording, this walks EVERY paywall in the app and asserts both providers
// are offered, against the same order.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Both providers configured -- that is the whole point of this file.
process.env.CLICK_MERCHANT_ID = "1111";
process.env.CLICK_SERVICE_ID = "2222";
process.env.CLICK_SECRET_KEY = "TOPSECRET";
process.env.PAYME_MERCHANT_ID = "merchant123";
process.env.PAYME_KEY = "PAYME_TEST_KEY";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");

const M = () => h.mainBot();

let nextId = 930000;
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

const urls = (sent) =>
  sent
    .flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat())
    .map((b) => b.url)
    .filter(Boolean);

// The two things every paywall must offer, and the one order behind them.
function assertBothProviders(sent, where) {
  const links = urls(sent);
  const click = links.filter((u) => u.includes("click.uz"));
  const payme = links.filter((u) => u.includes("paycom.uz"));

  assert.ok(click.length > 0, `${where}: no Click button`);
  assert.ok(payme.length > 0, `${where}: no Payme button — a paywall was left behind`);

  // Both must settle the SAME order: two checkouts for one purchase would let
  // somebody pay twice for a single thing.
  const clickOrder = new URL(click[0]).searchParams.get("transaction_param");
  const paymePayload = Buffer.from(payme[0].split("/").pop(), "base64").toString("utf8");
  assert.ok(
    paymePayload.includes(clickOrder),
    `${where}: the two buttons point at different orders (${clickOrder} vs ${paymePayload})`
  );
  return clickOrder;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("Premium offers both", async () => {
  const u = user("PremBuyer");
  await register(u, { gender: "male", name: "PremBuyer" });
  const sent = await h.send(M(), h.textUpdate("💎 Premium", u));
  assertBothProviders(sent, "Premium");
});

test("VIP chat offers both", async () => {
  const u = user("VipBuyer");
  await register(u, { gender: "male", name: "VipBuyer" });
  await h.send(M(), h.textUpdate("👑 VIP suhbat", u));
  const sent = await h.send(M(), h.callbackUpdate("vip:pay:choose", u));
  assertBothProviders(sent, "VIP chat");
});

test("the anonymous gender filter offers both", async () => {
  const u = user("AnonBuyer");
  await register(u, { gender: "male", name: "AnonBuyer" });
  await h.send(M(), h.textUpdate("🕵️ Anonim chat", u));
  const sent = await h.send(M(), h.textUpdate("👧 Qiz bola bilan", u));
  assertBothProviders(sent, "anon gender filter");
});

test("the profile unlock paywall offers both", async () => {
  const buyer = user("Unlocker");
  const target = user("Wanted");
  await register(buyer, { gender: "male", name: "Unlocker" });
  await register(target, { gender: "female", name: "Wanted" });

  const sent = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer));
  assertBothProviders(sent, "profile unlock");
});

test("the Mini App hands back both, not just the first", async () => {
  const u = user("MiniBuyer");
  await register(u, { gender: "male", name: "MiniBuyer" });

  const crypto = require("crypto");
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AA",
    user: JSON.stringify({ id: u.id, first_name: u.first_name }),
  };
  const dcs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update("111:TEST").digest();
  const hash = crypto.createHmac("sha256", secret).update(dcs).digest("hex");
  const qs = new URLSearchParams({ ...params, hash }).toString();

  const res = await fetch("http://127.0.0.1:45999/api/order?type=premium", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-init-data": qs },
  });
  const body = await res.json();

  assert.strictEqual(body.configured, true);
  const keys = (body.providers || []).map((p) => p.key).sort();
  assert.deepStrictEqual(keys, ["click", "payme"], `the Mini App must offer both, got ${JSON.stringify(keys)}`);
});

// The other half of the promise: with nothing configured, no screen may
// pretend one particular provider is the reason.
test("with neither configured, nothing names only Click", async () => {
  const { registerCheckoutHandlers } = require("../src/checkout");
  const { t } = require("../src/i18n");
  for (const lang of ["uz", "ru", "en"]) {
    const text = t(lang, "paymentsNotConfigured");
    assert.ok(/Click/i.test(text), `${lang}: should name Click`);
    assert.ok(/Payme/i.test(text), `${lang}: must name Payme too, not just Click`);
  }
  assert.strictEqual(typeof registerCheckoutHandlers, "function");
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
