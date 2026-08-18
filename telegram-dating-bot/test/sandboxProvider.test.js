// A payment button that cannot take money must not be on the screen.
//
// Payme's onboarding requires pointing at test.paycom.uz for as long as it
// takes them to approve the merchant. A checkout button leading there is
// worse than no button: it opens, the page looks entirely normal, the person
// enters a card -- and nothing ever reaches us. Every screen involved then
// reads as broken, and the report that comes back is "the Premium button
// doesn't work", which sends whoever is fixing it looking at the button.
//
// So: a provider in sandbox mode contributes no button at all, and the
// three-step note names only the providers actually shown -- "tap Click or
// Payme" above a lone Click button sends somebody hunting for a button that
// is not there, which is the same failure wearing different clothes.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

// Both providers configured, Payme deliberately in TEST mode -- exactly what
// production looks like during Payme onboarding. Set before anything reads
// them: payme.js freezes the checkout host at require time.
process.env.CLICK_MERCHANT_ID = "63267";
process.env.CLICK_SERVICE_ID = "110076";
process.env.PAYME_MERCHANT_ID = "6a83f6e029313b0e2af4613b";
process.env.PAYME_KEY = "test-key-not-a-real-one";
process.env.PAYME_CHECKOUT_URL = "https://test.paycom.uz";

const h = require("./harness");
const floodGuard = require("../src/floodGuard");
const { buildPaymentOptions } = require("../src/checkout");
const { t } = require("../src/i18n");

function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

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

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

const buttons = (sent) =>
  sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat());

const urlButtons = (sent) => buttons(sent).filter((b) => b.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let buyer;

test("setup: somebody who might want to pay", async () => {
  buyer = user("Buyer");
  await register(buyer, { gender: "male", name: "Buyer" });
});

// --- the sandbox rule --------------------------------------------------------

test("a provider pointed at its test host contributes no button", async () => {
  const { options } = await buildPaymentOptions(buyer.id, {
    type: "premium",
    amountSom: 79900,
    lang: "uz",
    t,
  });
  const keys = options.map((o) => o.key);
  assert.ok(!keys.includes("payme"), "a sandbox Payme button must not be offered");
  assert.deepStrictEqual(keys, ["click"], `only real-money providers, got ${keys}`);
});

test("no checkout url anywhere points at a test host", async () => {
  const { options } = await buildPaymentOptions(buyer.id, {
    type: "premium",
    amountSom: 79900,
    lang: "uz",
    t,
  });
  for (const option of options) {
    assert.ok(!/test\.paycom\.uz/i.test(option.url), `${option.key} leads to the sandbox: ${option.url}`);
  }
});

// The screen still has to work -- filtering a provider out must not leave a
// paywall with no way to pay while a real provider is sitting there configured.
test("the paywall still opens on the remaining provider", async () => {
  const { configured, rows } = await buildPaymentOptions(buyer.id, {
    type: "premium",
    amountSom: 79900,
    lang: "uz",
    t,
  });
  assert.strictEqual(configured, true, "Click is configured, so the paywall must open");
  assert.ok(rows.length >= 2, "a provider row and the confirm row");
});

// --- the same rule on every paywall ------------------------------------------

test("the Premium screen shows exactly one pay button", async () => {
  const sent = await h.send(M(), h.textUpdate("💎 Premium", buyer));
  const urls = urlButtons(sent);
  assert.strictEqual(urls.length, 1, `expected one pay button, got ${urls.length}`);
  assert.ok(!/paycom/i.test(urls[0].url), "and it must not be the Payme sandbox");
});

test("the VIP screen follows the same rule", async () => {
  await h.send(M(), h.textUpdate("👑 VIP suhbat", buyer));
  const sent = await h.send(M(), h.callbackUpdate("vip:pay:choose", buyer));
  const urls = urlButtons(sent);
  assert.strictEqual(urls.length, 1, `expected one pay button, got ${urls.length}`);
  assert.ok(!/test\.paycom/i.test(urls[0].url), "and it must not be the Payme sandbox");
});

test("every pay screen still offers the 'I have paid' button", async () => {
  const sent = await h.send(M(), h.textUpdate("💎 Premium", buyer));
  const confirm = buttons(sent).filter((b) => /^payments:done:/.test(b.callback_data || ""));
  assert.strictEqual(confirm.length, 1, "the confirm button must survive the filtering");
});

// --- the note matches the screen ---------------------------------------------

test("the note names only the providers actually shown", async () => {
  const text = said(await h.send(M(), h.textUpdate("💎 Premium", buyer)));
  assert.match(text, /1️⃣ Click tugmasini bosing/, "step 1 must name Click alone");
  assert.ok(!/Payme/.test(text), "Payme must not be mentioned when it has no button");
});

test("with both providers live the note names both", () => {
  const note = t("uz", "paymentHowToNote")("Click yoki Payme");
  assert.match(note, /Click yoki Payme/);
  const ru = t("ru", "paymentHowToNote")("Click или Payme");
  assert.match(ru, /Click или Payme/);
  const en = t("en", "paymentHowToNote")("Click or Payme");
  assert.match(en, /Click or Payme/);
});

test("the joining word is translated, not hardcoded Uzbek", () => {
  assert.strictEqual(t("uz", "paymentProviderJoin"), " yoki ");
  assert.strictEqual(t("ru", "paymentProviderJoin"), " или ");
  assert.strictEqual(t("en", "paymentProviderJoin"), " or ");
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
