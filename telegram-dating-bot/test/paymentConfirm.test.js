// "I have paid" -- the button that exists because Telegram tells the bot
// nothing about a URL button.
//
// Tapping Click or Payme leaves Telegram for the bank's page. Telegram sends
// no callback for that tap and none for the return, so the person comes back
// to a screen that looks exactly as it did before they paid. This button is
// how they say what happened -- and the thing that must never happen is that
// saying it is enough. The ledger decides; the claim does not.
//
// So the cases here are mostly refusals: an unpaid order, somebody else's
// order, an order id that does not exist. Each must produce the same honest
// "not confirmed yet" and hand over nothing.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

process.env.CLICK_MERCHANT_ID = "1111";
process.env.CLICK_SERVICE_ID = "2222";
process.env.CLICK_SECRET_KEY = "TOPSECRET";
process.env.PAYME_MERCHANT_ID = "merchant123";
process.env.PAYME_KEY = "PAYME_TEST_KEY";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const { getOrder } = require("../src/orders");

const BASE = "http://127.0.0.1:45999";
const M = () => h.mainBot();
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

const keyboard = (sent) => sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat());
const callbacks = (sent) => keyboard(sent).map((b) => b.callback_data).filter(Boolean);
const urls = (sent) => keyboard(sent).map((b) => b.url).filter(Boolean);

const confirmData = (sent) => callbacks(sent).find((d) => d.startsWith("payments:done:"));
const orderIdFrom = (sent) => (confirmData(sent) || "").slice("payments:done:".length);

// --- paying for real, through Click's actual callbacks ------------------------
const SIGN_TIME = "2026-08-11 10:00:00";
const prepareSign = (o) =>
  md5(`${o.click_trans_id}${o.service_id}TOPSECRET${o.merchant_trans_id}${o.amount}${o.action}${o.sign_time}`);
const completeSign = (o) =>
  md5(
    `${o.click_trans_id}${o.service_id}TOPSECRET${o.merchant_trans_id}${o.merchant_prepare_id}${o.amount}${o.action}${o.sign_time}`
  );

async function clickPost(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

let nextClickTrans = 8800;
async function payForReal(orderId) {
  const order = await getOrder(orderId);
  assert.ok(order, `order ${orderId} should exist before paying for it`);
  const clickTransId = String(nextClickTrans++);

  const prepare = {
    click_trans_id: clickTransId,
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(order.amount),
    action: "0",
    sign_time: SIGN_TIME,
    error: "0",
  };
  const prepared = await clickPost("/click/prepare", { ...prepare, sign_string: prepareSign(prepare) });
  assert.strictEqual(prepared.error, 0, `prepare failed: ${JSON.stringify(prepared)}`);

  const complete = {
    click_trans_id: clickTransId,
    service_id: "2222",
    merchant_trans_id: orderId,
    merchant_prepare_id: String(prepared.merchant_prepare_id),
    amount: String(order.amount),
    action: "1",
    sign_time: SIGN_TIME,
    error: "0",
  };
  const completed = await clickPost("/click/complete", { ...complete, sign_string: completeSign(complete) });
  assert.strictEqual(completed.error, 0, `complete failed: ${JSON.stringify(completed)}`);
  await wait(200);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- 1. the paywall's shape --------------------------------------------------

// Three buttons, in this order, on every paywall: the two ways to pay, then
// the way back. Without the third, someone who has paid has no way to tell
// the bot so, and the whole flow dead-ends on the bank's success page.
test("every paywall offers Click, Payme, and a confirm button", async () => {
  const buyer = user("ShapeBuyer");
  const target = user("ShapeTarget");
  await register(buyer, { gender: "male", name: "ShapeBuyer" });
  await register(target, { gender: "female", name: "ShapeTarget" });

  const screens = {
    premium: await h.send(M(), h.textUpdate("💎 Premium", buyer)),
    unlock: await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer)),
  };
  await h.send(M(), h.textUpdate("👑 VIP suhbat", buyer));
  screens.vip = await h.send(M(), h.callbackUpdate("vip:pay:choose", buyer));
  await h.send(M(), h.textUpdate("🕵️ Anonim chat", buyer));
  screens.anon = await h.send(M(), h.textUpdate("👧 Qiz bola bilan", buyer));

  for (const [where, sent] of Object.entries(screens)) {
    const links = urls(sent);
    assert.ok(links.some((u) => u.includes("click.uz")), `${where}: no Click button`);
    assert.ok(links.some((u) => u.includes("paycom.uz")), `${where}: no Payme button`);
    assert.ok(confirmData(sent), `${where}: no "I have paid" button — the flow dead-ends after payment`);

    // And the screen has to say what the three buttons are for BEFORE the
    // person leaves for the bank, because afterwards there is nothing of
    // ours left on screen to read.
    assert.match(said(sent), /To'lov qildim/, `${where}: the steps are not explained`);
  }
});

// --- 2. the refusals ---------------------------------------------------------

// The single most important case in this file. Someone taps "I have paid"
// before the money arrives -- often honestly, having just paid. Confirming
// on their word would hand out a paid feature for free, and would leave them
// certain nothing is owed when the charge later fails.
test("claiming to have paid, when the ledger says otherwise, grants nothing", async () => {
  const buyer = user("Claimer");
  const target = user("ClaimTarget");
  await register(buyer, { gender: "male", name: "Claimer" });
  await register(target, { gender: "female", name: "ClaimTarget" });

  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer));
  const orderId = orderIdFrom(paywall);
  assert.ok(orderId, "the paywall should carry an order to confirm");

  const claimed = await h.send(M(), h.callbackUpdate(`payments:done:${orderId}`, buyer));
  assert.match(said(claimed), /To'lov hali tasdiqlanmadi/, "it must say the payment is not confirmed");
  assert.ok(
    !callbacks(claimed).some((d) => d.startsWith("unlock:view:")),
    "and must not offer a way into the profile"
  );
  assert.ok(
    !claimed.some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "and must not reveal the contact"
  );
  assert.strictEqual((await getOrder(orderId)).status, "pending", "the order stays unpaid");
});

// Order ids are unguessable, but "unguessable" is not an access check. If one
// ever leaks -- a screenshot, a shared device -- it must still be worthless to
// anyone but its owner.
test("someone else's order id confirms nothing", async () => {
  const owner = user("Owner");
  const stranger = user("Stranger");
  const target = user("OwnerTarget");
  await register(owner, { gender: "male", name: "Owner" });
  await register(stranger, { gender: "male", name: "Stranger" });
  await register(target, { gender: "female", name: "OwnerTarget" });

  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, owner));
  const orderId = orderIdFrom(paywall);
  await payForReal(orderId);
  assert.strictEqual((await getOrder(orderId)).status, "paid", "the owner really did pay");

  const stolen = await h.send(M(), h.callbackUpdate(`payments:done:${orderId}`, stranger));
  assert.match(said(stolen), /To'lov hali tasdiqlanmadi/, "a paid order belonging to someone else reveals nothing");
  assert.ok(
    !callbacks(stolen).some((d) => d.startsWith("unlock:view:")),
    "and hands the stranger no route into the profile"
  );
});

test("an order id that does not exist is answered like an unpaid one", async () => {
  const u = user("Ghost");
  await register(u, { gender: "male", name: "Ghost" });
  const sent = await h.send(M(), h.callbackUpdate("payments:done:unlock_deadbeefdeadbeefdeadbeef", u));
  assert.match(said(sent), /To'lov hali tasdiqlanmadi/);
});

// --- 3. what a real payment produces -----------------------------------------

// After paying, the person is still on the bank's success page. Pushing a
// photo into the chat at that moment scrolls past unseen -- so delivery sends
// one message with the way in attached, which is still there when they come
// back to Telegram.
test("a real payment sends a button into the profile, not the profile itself", async () => {
  const buyer = user("RealBuyer");
  const target = user("RealTarget");
  await register(buyer, { gender: "male", name: "RealBuyer" });
  await register(target, { gender: "female", name: "RealTarget" });

  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer));
  const orderId = orderIdFrom(paywall);

  const before = h.calls.length;
  await payForReal(orderId);
  const delivered = h.calls.slice(before).filter((c) => String(c.payload.chat_id) === String(buyer.id));

  assert.match(said(delivered), /To'lov qabul qilindi/, "the buyer must be told the payment landed");
  assert.ok(
    callbacks(delivered).includes(`unlock:view:${target.id}`),
    "and given one button into the profile they bought"
  );

  // The button is a shortcut, not a second route around the paywall: pressing
  // it re-checks access, and here that access was really paid for.
  const opened = await h.send(M(), h.callbackUpdate(`unlock:view:${target.id}`, buyer));
  assert.ok(
    opened.some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "the profile, with contact, opens for the person who paid"
  );
});

// Pressing "I have paid" after the webhook already settled the order is the
// common case: people press it anyway. It has to confirm, not confuse.
test("pressing confirm after a real payment leads into the profile", async () => {
  const buyer = user("LateBuyer");
  const target = user("LateTarget");
  await register(buyer, { gender: "male", name: "LateBuyer" });
  await register(target, { gender: "female", name: "LateTarget" });

  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer));
  const orderId = orderIdFrom(paywall);
  await payForReal(orderId);

  const confirmed = await h.send(M(), h.callbackUpdate(`payments:done:${orderId}`, buyer));
  assert.match(said(confirmed), /To'lov qabul qilindi/);
  assert.ok(
    callbacks(confirmed).includes(`unlock:view:${target.id}`),
    "confirming should hand over the button into the profile"
  );
});

// --- 3b. looking a payment up from the admin panel ---------------------------
//
// A customer holding a Click receipt marked "Ko'rib chiqilmoqda" cannot tell
// whether the money reached us, and neither could the operator. The receipt
// prints the order id, so pasting it into the panel has to answer the actual
// question: whose side is this stuck on.
test("an unpaid order says so, and says what to check", () => {
  const { formatOrder, ORDER_ID_RE } = require("../src/adminBot").__test;

  // The id shape is the one Click prints as "Buyurtma raqami".
  assert.ok(ORDER_ID_RE.test("anongender_0f775d70a0faeca9dbbd1af9"), "a real order id is recognised");
  assert.ok(!ORDER_ID_RE.test("12345"), "a complaint code is not an order id");
  assert.ok(!ORDER_ID_RE.test("Jahongir"), "and neither is a search term");

  const text = formatOrder("anongender_abc123abc123abc123abc1234", {
    userId: "42",
    type: "anongender",
    amount: 12900,
    status: "pending",
    provider: "click",
    createdAt: "2026-08-17T13:39:00.000Z",
  });
  assert.match(text, /To'lanmagan/, "it must say the money never arrived");
  // The two causes have completely different fixes, so naming only one would
  // send the operator to the wrong place half the time.
  assert.match(text, /URL/, "one cause: Click was never told where to call");
  assert.match(text, /CLICK_SECRET_KEY/, "the other: we refused the call it made");
});

test("a paid order says the money arrived, and whether it was delivered", () => {
  const { formatOrder } = require("../src/adminBot").__test;

  const delivered = formatOrder("premium_abc123abc123abc123abc1234", {
    userId: "42", type: "premium", amount: 79900, status: "paid", provider: "click",
    paidAt: "2026-08-17T13:40:00.000Z", delivered: true,
  });
  assert.match(delivered, /To'langan/);
  assert.match(delivered, /Xizmat berilgan: ha/);

  // Money in, feature not handed over -- the one state that needs chasing.
  const stuck = formatOrder("premium_abc123abc123abc123abc1234", {
    userId: "42", type: "premium", amount: 79900, status: "paid", provider: "click",
    paidAt: "2026-08-17T13:40:00.000Z", delivered: false, deliveryAttempts: 3,
  });
  assert.match(stuck, /Xizmat hali berilmagan/);
  assert.match(stuck, /3 urinish/, "with how many times it has been retried");
});

test("an id that is not ours is not silently treated as a search", () => {
  const { formatOrder } = require("../src/adminBot").__test;
  const text = formatOrder("unlock_ffffffffffffffffffffffff", null);
  assert.match(text, /topilmadi/, "it must say plainly that no such order exists");
});

// End to end: a real order, looked up through the real panel.
test("pasting an order id into the panel reports its real state", async () => {
  const buyer = user("Lookup");
  const target = user("LookupTarget");
  await register(buyer, { gender: "male", name: "Lookup" });
  await register(target, { gender: "female", name: "LookupTarget" });

  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer));
  const orderId = orderIdFrom(paywall);

  // An admin, logged in.
  const admin = user("PayAdmin");
  await register(admin, { gender: "male", name: "PayAdmin" });
  const db = require("../src/db");
  await db.addAdmin(admin.id);
  await h.send(h.adminBot(), h.commandUpdate("/iamadmin", admin));
  for (const d of "13579") await h.send(h.adminBot(), h.callbackUpdate(`admin:pin:${d}`, admin));

  const before = await h.send(h.adminBot(), h.textUpdate(orderId, admin));
  assert.match(said(before), /To'lanmagan/, "unpaid before the callback");

  await payForReal(orderId);

  const after = await h.send(h.adminBot(), h.textUpdate(orderId, admin));
  assert.match(said(after), /To'langan/, "and paid after it");
  // The thousands separator is locale-dependent (a non-breaking space here),
  // so match the digits rather than the formatting.
  assert.match(said(after), /9.?900/, "with the amount that was actually charged");
});

// --- 4. congratulations ------------------------------------------------------

// Someone who has just spent 79 900 so'm should be told what they now have,
// not only that something was activated.
test("buying Premium is answered with what it unlocked", async () => {
  const buyer = user("PremiumBuyer");
  await register(buyer, { gender: "male", name: "PremiumBuyer" });

  const paywall = await h.send(M(), h.textUpdate("💎 Premium", buyer));
  const orderId = orderIdFrom(paywall);

  const before = h.calls.length;
  await payForReal(orderId);
  const delivered = h.calls.slice(before).filter((c) => String(c.payload.chat_id) === String(buyer.id));
  const text = said(delivered);

  assert.match(text, /Tabriklaymiz/, "it should congratulate, not just report a state change");
  assert.match(text, /cheksiz/i, "unlimited profile unlocks");
  assert.match(text, /Anonim chat/i, "the anon-chat gender filter it includes");
  assert.match(text, /30 kun/, "and how long it lasts");
});

test("buying VIP chat explains the group before handing over the link", async () => {
  const buyer = user("VipBuyer2");
  await register(buyer, { gender: "male", name: "VipBuyer2" });

  await h.send(M(), h.textUpdate("👑 VIP suhbat", buyer));
  const paywall = await h.send(M(), h.callbackUpdate("vip:pay:choose", buyer));
  const orderId = orderIdFrom(paywall);

  const before = h.calls.length;
  await payForReal(orderId);
  const text = said(h.calls.slice(before).filter((c) => String(c.payload.chat_id) === String(buyer.id)));

  assert.match(text, /Tabriklaymiz/, "it should congratulate");
  assert.match(text, /t\.me\//, "and still hand over the invite link");
});

// The three languages have to stay in step: a Russian- or English-speaking
// buyer hitting an Uzbek-only string is how a paywall silently breaks.
test("the confirm flow exists in all three languages", async () => {
  const { t } = require("../src/i18n");
  const keys = [
    "paymentDoneButton",
    "paymentProviderJoin",
    "paymentPendingNotice",
    "paymentConfirmedNotice",
    "unlockPaidOpenProfile",
    "unlockOpenProfileButton",
  ];
  for (const lang of ["uz", "ru", "en"]) {
    for (const key of keys) {
      const value = t(lang, key);
      assert.strictEqual(typeof value, "string", `${lang}.${key} should be a plain string`);
      assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
    }
    // The note takes the provider names actually on screen, so it is a
    // function of them rather than a fixed string -- a paywall showing one
    // provider must not tell people to look for two.
    for (const key of ["premiumPurchaseCongrats", "vipPurchaseCongrats", "paymentHowToNote"]) {
      assert.strictEqual(typeof t(lang, key), "function", `${lang}.${key} should take a parameter`);
    }
    const note = t(lang, "paymentHowToNote")("Click");
    assert.ok(note.includes("Click"), `${lang}.paymentHowToNote must use the names it is given`);
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
