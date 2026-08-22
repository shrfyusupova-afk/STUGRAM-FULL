// ForResult -- the paid advertising board.
//
// The whole product is one rule: the ranking is "who has put in the most",
// and paying again ADDS to your total rather than replacing it. Everything
// worth protecting here follows from that rule being true, and from money
// having changed hands over it:
//
//   * an unpaid draft must never occupy a slot -- the board is what people
//     are buying, so a free entry on it is theft from everyone who paid
//   * a top-up must move you UP, not reset you to the latest single payment,
//     or buying a higher place is impossible
//   * equal amounts must not swap places on refresh, which for something
//     people paid for reads as being cheated
//   * an ad hidden by a moderator must be gone from the board AND unreachable
//     by its id, or hiding it does nothing
//   * every field is public text somebody typed, rendered into HTML -- one
//     unescaped ampersand in a business name breaks the board for everyone
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
const floodGuard = require("../src/floodGuard");
const orders = require("../src/orders");
const { __test: fs_ } = require("../src/forResult");

const BASE = "http://127.0.0.1:45999";
const M = () => h.mainBot();
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

let nextId = 993000;
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

const callbacks = (sent) =>
  sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat()).map((b) => b.callback_data);

const urlButtons = (sent) =>
  sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat()).filter((b) => b.url);

const keyboardLabels = (sent) => {
  const out = [];
  for (const c of sent) {
    const kb = c.payload.reply_markup?.keyboard;
    if (kb) for (const row of kb) for (const b of row) out.push(typeof b === "string" ? b : b.text);
  }
  return out;
};

// Pays an order for real, through Click's own Prepare + Complete callbacks,
// so the ad going live is driven by the same delivery path production uses
// rather than by reaching into the database from the test.
const SIGN_TIME = "2026-08-11 10:00:00";
const prepareSign = (o) => md5(`${o.click_trans_id}${o.service_id}TOPSECRET${o.merchant_trans_id}${o.amount}${o.action}${o.sign_time}`);
const completeSign = (o) =>
  md5(`${o.click_trans_id}${o.service_id}TOPSECRET${o.merchant_trans_id}${o.merchant_prepare_id}${o.amount}${o.action}${o.sign_time}`);

let clickTx = 5000;
async function payOrder(orderId, amountSom) {
  clickTx += 1;
  const common = {
    click_trans_id: String(clickTx),
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: String(amountSom),
    sign_time: SIGN_TIME,
  };
  const post = (pathname, body) =>
    fetch(BASE + pathname, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    }).then((r) => r.json());

  const prep = { ...common, action: "0" };
  await post("/click/prepare", { ...prep, sign_string: prepareSign(prep) });
  const comp = { ...common, action: "1", merchant_prepare_id: orderId };
  return post("/click/complete", { ...comp, sign_string: completeSign(comp) });
}

// Drives the real wizard end to end and returns the order id the paywall
// created, so the test can then settle it.
async function addAd(u, { name, link, about, amount }) {
  await h.send(M(), h.callbackUpdate("fs:add", u));
  await h.send(M(), h.textUpdate(name, u));
  await h.send(M(), h.photoUpdate(u));
  await h.send(M(), h.textUpdate(link, u));
  await h.send(M(), h.textUpdate(about, u));
  const sent = await h.send(M(), h.textUpdate(String(amount), u));
  const done = callbacks(sent).find((d) => d && d.startsWith("payments:done:"));
  assert.ok(done, `the wizard must end on a paywall, got: ${said(sent)}`);
  return done.replace("payments:done:", "");
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- pure logic ---------------------------------------------------------------

// Demanding an https URL turned away the two things most advertisers here
// actually have: a Telegram channel they know as "@name", and a phone number.
test("a contact can be a link, a Telegram handle, or a phone number", () => {
  assert.strictEqual(fs_.normaliseContact("https://t.me/foroneforever").kind, "url");
  assert.strictEqual(fs_.normaliseContact("http://example.com/page").kind, "url");
  assert.strictEqual(fs_.normaliseContact("@kofexona").kind, "telegram");
  assert.strictEqual(fs_.normaliseContact("+998 90 123 45 67").kind, "phone");
  // However it was spaced or bracketed, and with or without the plus.
  assert.strictEqual(fs_.normaliseContact("+998 90 123 45 67").value, "+998901234567");
  assert.strictEqual(fs_.normaliseContact("998901234567").value, "+998901234567");
});

test("a contact that is none of the three is refused", () => {
  // This board shows every contact to every user and puts it one tap from
  // opening, so a javascript: or data: URL has no business being accepted.
  assert.strictEqual(fs_.normaliseContact("javascript:alert(1)"), null);
  assert.strictEqual(fs_.normaliseContact("data:text/html,<script>x</script>"), null);
  assert.strictEqual(fs_.normaliseContact("ftp://example.com"), null);
  assert.strictEqual(fs_.normaliseContact("not a link"), null);
  assert.strictEqual(fs_.normaliseContact("@ab"), null, "too short for a Telegram username");
  assert.strictEqual(fs_.normaliseContact(""), null);
  assert.strictEqual(fs_.normaliseContact("https://x.com/" + "a".repeat(300)), null, "over the length cap");
});

test("each contact kind gets its own icon and the right button target", () => {
  assert.strictEqual(fs_.contactUrl("@kofexona"), "https://t.me/kofexona", "a handle becomes a real link");
  assert.strictEqual(fs_.contactUrl("https://x.com/"), "https://x.com/");
  // Telegram makes a phone tappable in the text itself, and refuses a tel:
  // URL in an inline button -- so a phone gets no button rather than a broken one.
  assert.strictEqual(fs_.contactUrl("+998901234567"), null);
  assert.strictEqual(fs_.contactIcon("+998901234567"), "📞");
  assert.strictEqual(fs_.contactIcon("@kofexona"), "✈️");
  assert.strictEqual(fs_.contactIcon("https://x.com"), "🔗");
});

test("an amount is read out of whatever shape somebody types it in", () => {
  assert.strictEqual(fs_.parseAmount("50000"), 50000);
  assert.strictEqual(fs_.parseAmount("50 000"), 50000);
  assert.strictEqual(fs_.parseAmount("50,000 so'm"), 50000);
  assert.strictEqual(fs_.parseAmount("abc"), null);
  assert.strictEqual(fs_.parseAmount(""), null);
});

test("the amount is bounded at both ends", () => {
  assert.strictEqual(orders.isValidAdAmount(orders.AD_MIN_SOM), true);
  assert.strictEqual(orders.isValidAdAmount(orders.AD_MAX_SOM), true);
  assert.strictEqual(orders.isValidAdAmount(orders.AD_MIN_SOM - 1), false);
  // The ceiling is a typo guard: somebody meaning 50 000 who holds the zero
  // key would otherwise be charged tens of millions.
  assert.strictEqual(orders.isValidAdAmount(orders.AD_MAX_SOM + 1), false);
  assert.strictEqual(orders.isValidAdAmount(1.5), false);
});

test("a name or description containing HTML cannot break the board", () => {
  const rendered = fs_.renderRest(
    [{ id: "1", name: "Kofe & Co <b>", about: "a > b & c", link: "https://x.com", amountSom: 5000 }],
    1,
    "uz"
  ).text;
  assert.ok(!rendered.includes("Kofe & Co <b>"), "the raw markup must not survive into the message");
  assert.ok(rendered.includes("Kofe &amp; Co &lt;b&gt;"), "it must be escaped instead");
});

test("ten full-length ads still fit inside Telegram's message limit", () => {
  const ads = Array.from({ length: 10 }, (_, i) => ({
    id: String(1000 + i),
    name: "N".repeat(fs_.NAME_MAX),
    about: "A".repeat(fs_.ABOUT_MAX),
    link: `https://example.com/${"L".repeat(180)}`,
    amountSom: 999999999,
  }));
  const { text } = fs_.renderRest(ads, 1, "uz");
  assert.ok(text.length < 4096, `a full page must not exceed 4096 characters, got ${text.length}`);
});

test("the board pages ten at a time", () => {
  const ads = Array.from({ length: 25 }, (_, i) => ({
    id: String(i + 1),
    name: `Ad ${i + 1}`,
    about: "x",
    link: "https://x.com",
    amountSom: 1000 * (25 - i),
  }));
  const p1 = fs_.renderRest(ads, 1, "uz");
  assert.strictEqual(p1.pages, 3);
  assert.ok(p1.text.includes("/ad_1") && p1.text.includes("/ad_10"));
  assert.ok(!p1.text.includes("/ad_11"), "page one must stop at ten");

  const p3 = fs_.renderRest(ads, 3, "uz");
  assert.ok(p3.text.includes("/ad_21") && p3.text.includes("/ad_25"));

  // A page number beyond the end (a stale button from an older, longer board)
  // must clamp rather than render an empty screen.
  assert.strictEqual(fs_.renderRest(ads, 99, "uz").page, 3);
});

test("the list numbers places below the podium and never restarts", () => {
  const rest = Array.from({ length: 15 }, (_, i) => ({
    id: String(i + 1),
    name: `Ad ${i + 1}`,
    about: "x",
    link: "https://x.com",
    amountSom: 1000 * (15 - i),
  }));
  // The top three are shown as full cards, so the list opens at place 4.
  const page1 = fs_.renderRest(rest, 1, "uz").text;
  assert.ok(page1.includes("<b>4-O'RIN</b>"), "the list starts where the podium ends");
  assert.ok(!page1.includes("<b>1-O'RIN</b>"), "and never repeats a podium place");

  // Page two carries on rather than starting over. Matched with the opening
  // tag included: "14-O'RIN" ends with the text "4-O'RIN", so a bare substring
  // check cannot tell the two apart.
  const page2 = fs_.renderRest(rest, 2, "uz").text;
  assert.ok(page2.includes("<b>14-O'RIN</b>"), "page two carries on at place 14");
  assert.ok(!page2.includes("<b>4-O'RIN</b>"), "and does not restart");
});

test("abandoned drafts and screen positions do not sit in memory forever", () => {
  fs_.drafts.set("999999", { step: "name", at: Date.now() - fs_.TTL_MS - 1000 });
  fs_.screens.set("999997", { screen: "board", at: Date.now() - fs_.TTL_MS - 1000 });
  fs_.drafts.set("999998", { step: "name", at: Date.now() });
  const removed = fs_.sweepState();
  assert.ok(removed >= 2, "both stale entries must be swept");
  assert.strictEqual(fs_.drafts.has("999999"), false);
  assert.strictEqual(fs_.screens.has("999997"), false);
  assert.strictEqual(fs_.drafts.has("999998"), true, "a live draft must survive");
  fs_.drafts.delete("999998");
});

// --- the order carries the amount the buyer named -----------------------------

test("an ad order stores the buyer's own amount, not a fixed price", async () => {
  const buyer = user("Amounter");
  await register(buyer, { gender: "male", name: "Amounter" });
  const adId = await db.createAd({
    userId: buyer.id, name: "X", about: "y", link: "https://x.com", mediaFileId: null,
  });
  const orderId = await orders.createOrder(buyer.id, { type: "adboard", targetId: adId, amountSom: 77000 });
  const order = await orders.getOrder(orderId);
  assert.strictEqual(order.amount, 77000);
});

// The guard that keeps "the buyer names the amount" from leaking into
// everything else priced by a constant.
test("a fixed-price product ignores any amount a caller passes", async () => {
  const buyer = user("Fixed");
  await register(buyer, { gender: "male", name: "Fixed" });
  const orderId = await orders.createOrder(buyer.id, { type: "premium", amountSom: 1 });
  const order = await orders.getOrder(orderId);
  assert.strictEqual(order.amount, orders.PREMIUM_PRICE_SOM, "Premium must still cost what Premium costs");
});

test("an ad order with no amount, or a nonsense one, is refused outright", async () => {
  const buyer = user("NoAmount");
  await register(buyer, { gender: "male", name: "NoAmount" });
  await assert.rejects(() => orders.createOrder(buyer.id, { type: "adboard", targetId: "1" }));
  await assert.rejects(() => orders.createOrder(buyer.id, { type: "adboard", targetId: "1", amountSom: 10 }));
});

// --- storage: the ranking rule ------------------------------------------------

test("an ad is invisible until it is actually paid for", async () => {
  const owner = user("Unpaid");
  await register(owner, { gender: "male", name: "Unpaid" });
  const adId = await db.createAd({
    userId: owner.id, name: "Draft", about: "not paid", link: "https://x.com", mediaFileId: null,
  });
  const board = await db.listTopAds(50);
  assert.ok(!board.some((ad) => String(ad.id) === String(adId)), "an unpaid ad must not occupy a slot");
});

test("paying again ADDS to the total and moves the ad up", async () => {
  const owner = user("TopUp");
  await register(owner, { gender: "male", name: "TopUp" });
  const adId = await db.createAd({
    userId: owner.id, name: "Climber", about: "x", link: "https://x.com", mediaFileId: null,
  });
  const first = await db.addAdAmount(adId, 10000);
  assert.strictEqual(first.amountSom, 10000);
  assert.strictEqual(first.active, true, "money makes it visible");

  const second = await db.addAdAmount(adId, 25000);
  assert.strictEqual(second.amountSom, 35000, "a top-up must accumulate, not replace");
});

test("the board is ordered by money, highest first", async () => {
  const owner = user("Ranker");
  await register(owner, { gender: "male", name: "Ranker" });
  const small = await db.createAd({ userId: owner.id, name: "Small", about: "x", link: "https://x.com" });
  const big = await db.createAd({ userId: owner.id, name: "Big", about: "x", link: "https://x.com" });
  await db.addAdAmount(small, 6000);
  await db.addAdAmount(big, 900000);

  const board = await db.listTopAds(50);
  assert.strictEqual(String(board[0].id), String(big), "the biggest spender sits at the top");
  const smallPlace = board.findIndex((ad) => String(ad.id) === String(small));
  const bigPlace = board.findIndex((ad) => String(ad.id) === String(big));
  assert.ok(bigPlace < smallPlace);
});

test("hiding an ad removes it from the board without destroying the record", async () => {
  const owner = user("Hidden");
  await register(owner, { gender: "male", name: "Hidden" });
  const adId = await db.createAd({ userId: owner.id, name: "Naughty", about: "x", link: "https://x.com" });
  await db.addAdAmount(adId, 50000);
  assert.ok((await db.listTopAds(50)).some((a) => String(a.id) === String(adId)));

  await db.setAdActive(adId, false);
  assert.ok(!(await db.listTopAds(50)).some((a) => String(a.id) === String(adId)), "hidden means off the board");

  // The money and the row survive, so a wrongly hidden ad can be restored.
  const still = await db.getAd(adId);
  assert.strictEqual(still.amountSom, 50000);
  await db.setAdActive(adId, true);
  assert.ok((await db.listTopAds(50)).some((a) => String(a.id) === String(adId)), "and it can come back");
  await db.setAdActive(adId, false);
});

// --- through the bot ----------------------------------------------------------

test("the main menu carries the ForResult button", async () => {
  const u = user("Menu");
  const sent = await register(u, { gender: "male", name: "Menu" });
  assert.ok(
    keyboardLabels(sent).some((l) => l && l.includes("ForResult")),
    "the button must be on the main keyboard"
  );
});

// Deliberately a RETURN, not the end of registration: a brand-new user
// already gets a welcome, a channel invite and possibly a referral notice at
// that moment, and a fourth message on top would bury all of them. The promo
// rides with every genuine return to the menu instead -- /start when already
// registered, the Back button out of browsing, and so on.
test("returning to the main menu advertises the board", async () => {
  const u = user("Promo");
  await register(u, { gender: "male", name: "Promo" });

  // /start re-offers the language picker; picking one is what actually
  // returns an already-registered person to their menu.
  await h.send(M(), h.commandUpdate("/start", u));
  const sent = await h.send(M(), h.callbackUpdate("lang:uz", u));
  assert.ok(callbacks(sent).includes("fs:open"), "the promo and its button must ride along with the menu");
  assert.match(said(sent), /afishangizni yuklang/, "and it must pitch, not just link");
});

test("the promo failing can never block the main menu itself", async () => {
  const u = user("PromoFail");
  await register(u, { gender: "male", name: "PromoFail" });

  // The promo is an advert. If sending it breaks, the person must still get
  // their menu -- the alternative is a bot that cannot be navigated because
  // an ad failed to render.
  h.failApi((method, payload) =>
    method === "sendMessage" && /afishangizni yuklang/.test(payload.text || "")
      ? "Bad Request: simulated"
      : null
  );
  try {
    await h.send(M(), h.commandUpdate("/start", u));
    const sent = await h.send(M(), h.callbackUpdate("lang:uz", u));
    assert.match(said(sent), /menyu|Asosiy/i, "the main menu still has to arrive");
  } finally {
    h.failApi(null);
  }
});

test("the board docks its four buttons under the input box", async () => {
  const u = user("Opener");
  await register(u, { gender: "male", name: "Opener" });
  const sent = await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  const labels = keyboardLabels(sent);
  // A reply keyboard, not an inline row: the board is a place you stay in and
  // act from, and an inline row scrolls away the moment anything else arrives.
  assert.ok(labels.some((l) => l.includes("afishamni")), "add my ad");
  assert.ok(labels.some((l) => l.includes("Mening afisham")), "my ad");
  assert.ok(labels.some((l) => l.includes("ma'lumotlari")), "what ForResult is");
  assert.ok(labels.some((l) => l.includes("Orqaga")), "back");
});

test("the info screen explains the rule and names the channel", async () => {
  const u = user("Curious");
  await register(u, { gender: "male", name: "Curious" });
  const text = said(await h.send(M(), h.callbackUpdate("fs:info", u)));
  assert.match(text, /@foroneforever/, "the daily channel promotion is part of the pitch");
  assert.match(text, /1-o'rin/, "it must state that the top spot is bought");
});

test("the wizard walks all five steps and ends on a paywall", async () => {
  const u = user("Advertiser");
  await register(u, { gender: "male", name: "Advertiser" });

  const start = said(await h.send(M(), h.callbackUpdate("fs:add", u)));
  assert.match(start, /1\/5/, "step one asks for the name");

  const afterName = said(await h.send(M(), h.textUpdate("Kofe Xona", u)));
  assert.match(afterName, /2\/5/, "step two asks for the photo");

  const afterPhoto = said(await h.send(M(), h.photoUpdate(u)));
  assert.match(afterPhoto, /3\/5/, "step three asks for the link");

  const afterLink = said(await h.send(M(), h.textUpdate("https://t.me/kofexona", u)));
  assert.match(afterLink, /4\/5/, "step four asks for the description");

  const afterAbout = said(await h.send(M(), h.textUpdate("Eng mazali kofe", u)));
  assert.match(afterAbout, /5\/5/, "step five asks for the amount");

  const sent = await h.send(M(), h.textUpdate("60000", u));
  assert.ok(
    callbacks(sent).some((d) => d && d.startsWith("payments:done:")),
    "the last step must produce a real paywall"
  );
  assert.ok(urlButtons(sent).length >= 1, "with a provider button on it");
});

test("each step refuses a bad answer instead of accepting it", async () => {
  const u = user("Sloppy");
  await register(u, { gender: "male", name: "Sloppy" });
  await h.send(M(), h.callbackUpdate("fs:add", u));

  assert.match(said(await h.send(M(), h.textUpdate("x", u))), /2 tadan 40/, "a one-character name");
  await h.send(M(), h.textUpdate("Good Name", u));

  // Text where a photo is required.
  assert.match(said(await h.send(M(), h.textUpdate("not a photo", u))), /rasm/i);
  await h.send(M(), h.photoUpdate(u));

  assert.match(said(await h.send(M(), h.textUpdate("javascript:alert(1)", u))), /https/i, "a non-http link");
  await h.send(M(), h.textUpdate("https://t.me/x", u));

  assert.match(said(await h.send(M(), h.textUpdate("hi", u))), /5 tadan 100/, "too short a description");
  await h.send(M(), h.textUpdate("A real description", u));

  assert.match(said(await h.send(M(), h.textUpdate("10", u))), /so'm/, "an amount under the floor");
});

test("tapping a menu button mid-wizard leaves the wizard instead of being filed as an answer", async () => {
  const u = user("Changed");
  await register(u, { gender: "male", name: "Changed" });
  await h.send(M(), h.callbackUpdate("fs:add", u));

  const sent = await h.send(M(), h.textUpdate("💎 Premium", u));
  const text = said(sent);
  assert.match(text, /Premium/, "the Premium screen must actually open");
  assert.ok(!/2\/5/.test(text), "and the name step must not have swallowed the tap");
  assert.strictEqual(fs_.drafts.has(String(u.id)), false, "the draft is dropped");
});

// --- payment puts the ad on the board -----------------------------------------

test("paying for an ad puts it on the board at the place the money bought", async () => {
  const u = user("Payer");
  await register(u, { gender: "male", name: "Payer" });

  const orderId = await addAd(u, {
    name: "Big Spender",
    link: "https://t.me/bigspender",
    about: "The most expensive ad on this board",
    amount: 5000000,
  });
  const res = await payOrder(orderId, 5000000);
  assert.strictEqual(res.error, 0, `the payment must be accepted: ${JSON.stringify(res)}`);

  const board = await db.listTopAds(50);
  assert.strictEqual(board[0].name, "Big Spender", "the biggest payment takes first place");
  assert.strictEqual(board[0].amountSom, 5000000);
});

test("the buyer is told where they landed", async () => {
  const u = user("Told");
  await register(u, { gender: "male", name: "Told" });
  const orderId = await addAd(u, {
    name: "Modest", link: "https://t.me/modest", about: "A modest little ad", amount: 7000,
  });

  const before = h.calls.length;
  await payOrder(orderId, 7000);
  const text = said(h.calls.slice(before).filter((c) => String(c.payload.chat_id) === String(u.id)));
  assert.match(text, /Tabriklaymiz/, "a congratulation");
  assert.match(text, /o'rin/, "naming the place they got");
});

test("/ad_<id> opens one entry in full, and a hidden one is gone", async () => {
  const u = user("Reader");
  await register(u, { gender: "male", name: "Reader" });
  const orderId = await addAd(u, {
    name: "Readable", link: "https://t.me/readable", about: "Something worth reading", amount: 9000,
  });
  await payOrder(orderId, 9000);

  const order = await orders.getOrder(orderId);
  const adId = order.targetId;

  const shown = await h.send(M(), h.textUpdate(`/ad_${adId}`, u));
  assert.match(said(shown), /Readable/, "the ad opens");
  assert.ok(urlButtons(shown).some((b) => b.url === "https://t.me/readable"), "with its link one tap away");

  // Once a moderator takes it down it must be unreachable by id too --
  // otherwise hiding it only removes it from a list it was never found in.
  await db.setAdActive(adId, false);
  const gone = await h.send(M(), h.textUpdate(`/ad_${adId}`, u));
  assert.match(said(gone), /topilmadi/, "a hidden ad reads as not there");
  assert.ok(!/Readable/.test(said(gone)), "and none of its content leaks");
});

test("an ad id that was never issued is answered, not crashed on", async () => {
  const u = user("Prober");
  await register(u, { gender: "male", name: "Prober" });
  const sent = await h.send(M(), h.textUpdate("/ad_99999999", u));
  assert.match(said(sent), /topilmadi/);
});

// --- moderation, in the main bot ------------------------------------------------
//
// The screen carries live ad ids, the owners' Telegram ids and what each of
// them paid, and its commands take ads off a board people paid to be on. So
// the rule tested here is not "a non-admin is refused" but "a non-admin sees
// nothing at all" -- a refusal message is itself a confirmation that the
// command exists.

test("an admin gets a moderation button on the board; nobody else does", async () => {
  const boss = user("Boss");
  await register(boss, { gender: "male", name: "Boss" });
  const plain = user("Plain");
  await register(plain, { gender: "male", name: "Plain" });
  await db.addAdmin(boss.id);

  const adminView = await h.send(M(), h.callbackUpdate("fs:open", boss));
  assert.ok(callbacks(adminView).includes("fs:mod"), "the admin must get the moderation button");

  const userView = await h.send(M(), h.callbackUpdate("fs:open", plain));
  assert.ok(!callbacks(userView).includes("fs:mod"), "an ordinary user must not even see it exists");
});

test("the moderation list marks hidden ads and offers the matching command", async () => {
  const boss = user("Lister");
  await register(boss, { gender: "male", name: "Lister" });
  await db.addAdmin(boss.id);

  const live = await db.createAd({ userId: boss.id, name: "Live One", about: "x", link: "https://x.com" });
  const hidden = await db.createAd({ userId: boss.id, name: "Hidden One", about: "x", link: "https://y.com" });
  await db.addAdAmount(live, 30000);
  await db.addAdAmount(hidden, 20000);
  await db.setAdActive(hidden, false);

  const text = said(await h.send(M(), h.textUpdate(fs_.ADS_COMMAND, boss)));
  assert.match(text, /Live One/, "a live ad is listed");
  assert.match(text, /Hidden One/, "and so is a hidden one -- that is the point of the screen");
  assert.match(text, new RegExp(`/adhide_${live}`), "a live ad offers the hide command");
  assert.match(text, new RegExp(`/adshow_${hidden}`), "a hidden ad offers the restore command");
});

test("a non-admin gets nothing from the moderation command", async () => {
  const nosy = user("Nosy");
  await register(nosy, { gender: "male", name: "Nosy" });
  const text = said(await h.send(M(), h.textUpdate(fs_.ADS_COMMAND, nosy)));
  assert.ok(!/ForResult afishalari/.test(text), "the screen must not open");
  assert.ok(!/adhide_/.test(text), "and no ad ids may leak");
});

test("an admin can hide and restore an ad from the main bot", async () => {
  const boss = user("Mod");
  await register(boss, { gender: "male", name: "Mod" });
  await db.addAdmin(boss.id);

  const adId = await db.createAd({ userId: boss.id, name: "Naughty", about: "x", link: "https://x.com" });
  await db.addAdAmount(adId, 40000);

  await h.send(M(), h.textUpdate(`/adhide_${adId}`, boss));
  assert.strictEqual((await db.getAd(adId)).active, false, "the ad comes off the board");

  await h.send(M(), h.textUpdate(`/adshow_${adId}`, boss));
  assert.strictEqual((await db.getAd(adId)).active, true, "and can be put back");
  await db.setAdActive(adId, false);
});

// The commands hide ads people have paid to show. Anyone being able to run
// them would let one user quietly delete a competitor off a board they paid
// for.
test("a non-admin cannot hide an ad, and is not told the command exists", async () => {
  const owner = user("Owner");
  await register(owner, { gender: "male", name: "Owner" });
  const attacker = user("Attacker");
  await register(attacker, { gender: "male", name: "Attacker" });

  const adId = await db.createAd({ userId: owner.id, name: "Paid For", about: "x", link: "https://x.com" });
  await db.addAdAmount(adId, 80000);

  const text = said(await h.send(M(), h.textUpdate(`/adhide_${adId}`, attacker)));
  assert.strictEqual((await db.getAd(adId)).active, true, "the ad must still be on the board");
  assert.ok(!/yashirildi|topilmadi/.test(text), "and nothing may confirm the command exists");
  await db.setAdActive(adId, false);
});

// --- what each podium place costs -------------------------------------------------
//
// This is the number that makes topping up worth doing, so it has to be right
// in the two ways it can be wrong: counting yourself as an obstacle to
// yourself, and quoting an amount that only DRAWS with the holder. Ties are
// broken by who paid first, so matching an amount does not overtake it.

test("the gap to each place is what it takes to OVERTAKE, not to draw", () => {
  const board = [
    { id: "1", amountSom: 500000 },
    { id: "2", amountSom: 300000 },
    { id: "3", amountSom: 100000 },
    { id: "9", amountSom: 50000 },
  ];
  const gaps = fs_.gapsFor(board, { id: "9", amountSom: 50000 });
  assert.deepStrictEqual(
    gaps,
    [
      { place: 1, need: 450001 },
      { place: 2, need: 250001 },
      { place: 3, need: 50001 },
    ],
    "each figure must be one so'm past the holder, not level with them"
  );
});

test("your own ad is never counted as standing in your own way", () => {
  const board = [
    { id: "7", amountSom: 400000 },
    { id: "1", amountSom: 300000 },
    { id: "2", amountSom: 100000 },
  ];
  // #7 already holds first place. Places 1..3 among the OTHERS are all below
  // them, so there is nothing left to buy.
  assert.deepStrictEqual(fs_.gapsFor(board, { id: "7", amountSom: 400000 }), []);
});

test("the second-placed ad is quoted only the gap to first", () => {
  const board = [
    { id: "1", amountSom: 500000 },
    { id: "5", amountSom: 300000 },
    { id: "3", amountSom: 100000 },
  ];
  const gaps = fs_.gapsFor(board, { id: "5", amountSom: 300000 });
  assert.deepStrictEqual(gaps, [{ place: 1, need: 200001 }], "it already beats everyone else");
});

// --- the podium is shown as cards --------------------------------------------------

test("the top three arrive as full picture cards, the rest as a list", async () => {
  const u = user("Viewer");
  await register(u, { gender: "male", name: "Viewer" });

  // Four paid ads, funded above everything earlier tests in this file left on
  // the board, so these four really are places 1-4 and the podium is theirs.
  // All four carry a picture: an ad without one falls back to a text card by
  // design, which would make "count the photo cards" measure the fixtures
  // rather than the podium.
  for (const [name, amount] of [["First", 9000000], ["Second", 8000000], ["Third", 7000000], ["Fourth", 6000000]]) {
    const owner = user(`Own${name}`);
    await register(owner, { gender: "male", name: `Own${name}` });
    const id = await db.createAd({ userId: owner.id, name, about: "x", link: "https://x.com", mediaFileId: "PIC" });
    await db.addAdAmount(id, amount);
  }

  const sent = await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  const cards = sent.filter((c) => c.method === "sendPhoto");
  assert.strictEqual(cards.length, 3, `the podium is three cards, got ${cards.length}`);
  assert.ok(cards.some((c) => (c.payload.caption || "").includes("First")));

  // And the fourth is in the list, not a card.
  const text = said(sent);
  assert.match(text, /Fourth/, "everyone below the podium is in the list");
  assert.ok(!cards.some((c) => (c.payload.caption || "").includes("Fourth")), "and not given a card");
});

// --- my ad ---------------------------------------------------------------------------

test("somebody with no ad is told so and pointed at the way to make one", async () => {
  const u = user("Adless");
  await register(u, { gender: "male", name: "Adless" });
  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  const sent = await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  assert.match(said(sent), /hali afisha yo'q/, "it must say plainly that there is none");
});

test("my ad shows the owner's own ad with the top-up and edit buttons", async () => {
  const u = user("Owner2");
  await register(u, { gender: "male", name: "Owner2" });
  const id = await db.createAd({ userId: u.id, name: "Mine", about: "x", link: "@minechannel", mediaFileId: "PIC" });
  await db.addAdAmount(id, 65000);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  const sent = await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  assert.match(said(sent), /Mine/, "their ad is shown");
  const labels = keyboardLabels(sent);
  assert.ok(labels.some((l) => l.includes("To'lov qo'shish")), "add payment");
  assert.ok(labels.some((l) => l.includes("Tahrirlash")), "edit");
  assert.ok(labels.some((l) => l.includes("Orqaga")), "back");
});

// An owner whose ad was taken down has to be able to see that it was, rather
// than find it simply missing with no explanation.
test("a hidden ad is still shown to its owner, marked as hidden", async () => {
  const u = user("Owner3");
  await register(u, { gender: "male", name: "Owner3" });
  const id = await db.createAd({ userId: u.id, name: "Taken Down", about: "x", link: "https://x.com" });
  await db.addAdAmount(id, 55000);
  await db.setAdActive(id, false);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  const text = said(await h.send(M(), h.textUpdate("📌 Mening afisham", u)));
  assert.match(text, /Taken Down/, "the owner still sees it");
  assert.match(text, /yashirilgan/, "and is told it is hidden");
});

test("the top-up screen quotes what each podium place would cost", async () => {
  const u = user("Climber2");
  await register(u, { gender: "male", name: "Climber2" });
  const id = await db.createAd({ userId: u.id, name: "Climbing", about: "x", link: "https://x.com" });
  await db.addAdAmount(id, 10000);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  const text = said(await h.send(M(), h.textUpdate("💰 To'lov qo'shish", u)));
  assert.match(text, /yetmayapti/, "it must name what is still missing");
  assert.match(text, /1-o'rin/, "for first place at least");
});

test("topping up ends on a paywall for the SAME ad, not a new one", async () => {
  const u = user("TopPay");
  await register(u, { gender: "male", name: "TopPay" });
  const id = await db.createAd({ userId: u.id, name: "Existing", about: "x", link: "https://x.com" });
  await db.addAdAmount(id, 20000);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  await h.send(M(), h.textUpdate("💰 To'lov qo'shish", u));
  const sent = await h.send(M(), h.textUpdate("30000", u));

  const done = callbacks(sent).find((d) => d && d.startsWith("payments:done:"));
  assert.ok(done, `a top-up must produce a paywall: ${said(sent)}`);
  const order = await orders.getOrder(done.replace("payments:done:", ""));
  assert.strictEqual(String(order.targetId), String(id), "the payment must point at the existing ad");
  assert.strictEqual(order.amount, 30000, "and carry the amount they just named");
});

// --- editing --------------------------------------------------------------------------

test("an owner can edit one field without touching the others or the money", async () => {
  const u = user("Editor");
  await register(u, { gender: "male", name: "Editor" });
  const id = await db.createAd({ userId: u.id, name: "Old Name", about: "old about", link: "https://old.com" });
  await db.addAdAmount(id, 45000);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  await h.send(M(), h.textUpdate("✏️ Tahrirlash", u));
  await h.send(M(), h.textUpdate("📌 Nomi", u));
  await h.send(M(), h.textUpdate("Brand New Name", u));

  const ad = await db.getAd(id);
  assert.strictEqual(ad.name, "Brand New Name", "the name changed");
  assert.strictEqual(ad.about, "old about", "everything else was left alone");
  assert.strictEqual(ad.link, "https://old.com");
  // The amount decides the ranking, so it must only ever move through a payment.
  assert.strictEqual(ad.amountSom, 45000, "editing must never change the money");
});

// The whitelist in updateAd, tested where it can actually be reached. The
// edit screen never offers the amount, so driving this through the bot would
// only prove the screen -- a future caller passing the field straight in is
// exactly what the whitelist exists to stop, and money is the one field that
// decides the ranking everybody paid for.
test("updateAd refuses to change the money, whatever a caller passes", async () => {
  const u = user("Tamper");
  await register(u, { gender: "male", name: "Tamper" });
  const id = await db.createAd({ userId: u.id, name: "Priced", about: "x", link: "https://x.com" });
  await db.addAdAmount(id, 45000);

  await db.updateAd(id, { name: "Renamed", amountSom: 99999999, active: true, userId: "999" });

  const ad = await db.getAd(id);
  assert.strictEqual(ad.name, "Renamed", "an allowed field still changes");
  assert.strictEqual(ad.amountSom, 45000, "the money must be untouchable through this door");
  assert.strictEqual(String(ad.userId), String(u.id), "and so must the owner");
});

test("editing the contact accepts a Telegram handle", async () => {
  const u = user("Editor2");
  await register(u, { gender: "male", name: "Editor2" });
  const id = await db.createAd({ userId: u.id, name: "Contactable", about: "x", link: "https://old.com" });
  await db.addAdAmount(id, 45000);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  await h.send(M(), h.textUpdate("✏️ Tahrirlash", u));
  await h.send(M(), h.textUpdate("🔗 Havolasi", u));
  await h.send(M(), h.textUpdate("@newchannel", u));

  assert.strictEqual((await db.getAd(id)).link, "@newchannel");
});

// --- navigation -------------------------------------------------------------------------

test("back steps out one level at a time, not straight home", async () => {
  const u = user("Walker");
  await register(u, { gender: "male", name: "Walker" });
  const id = await db.createAd({ userId: u.id, name: "Walkable", about: "x", link: "https://x.com" });
  await db.addAdAmount(id, 45000);

  await h.send(M(), h.textUpdate("📊 ForResult — reklama taxtasi", u));
  await h.send(M(), h.textUpdate("📌 Mening afisham", u));
  await h.send(M(), h.textUpdate("✏️ Tahrirlash", u));

  // edit -> my ad
  const toMyAd = await h.send(M(), h.textUpdate("⬅️ Orqaga", u));
  assert.ok(keyboardLabels(toMyAd).some((l) => l.includes("To'lov qo'shish")), "back from edit lands on my ad");

  // my ad -> board
  const toBoard = await h.send(M(), h.textUpdate("⬅️ Orqaga", u));
  assert.ok(keyboardLabels(toBoard).some((l) => l.includes("Mening afisham")), "back from my ad lands on the board");

  // board -> main menu
  const toMenu = await h.send(M(), h.textUpdate("⬅️ Orqaga", u));
  assert.ok(keyboardLabels(toMenu).some((l) => l.includes("Yangi tanishuvlar")), "back from the board goes home");
});

// The back button is shared with the rest of the bot. Somebody who has never
// opened ForResult must have it behave exactly as it always did.
test("back outside ForResult is left to whoever owns it", async () => {
  const u = user("Elsewhere");
  await register(u, { gender: "male", name: "Elsewhere" });
  const sent = await h.send(M(), h.textUpdate("⬅️ Orqaga", u));
  assert.ok(
    keyboardLabels(sent).some((l) => l.includes("Yangi tanishuvlar")),
    "the ordinary back behaviour must survive"
  );
});

// --- a phone contact end to end ------------------------------------------------------

test("an ad can be reached by phone number, with no broken link button", async () => {
  const u = user("Caller");
  await register(u, { gender: "male", name: "Caller" });
  const orderId = await addAd(u, {
    name: "Call Me", link: "+998901112233", about: "Phone only, no website", amount: 12000,
  });
  await payOrder(orderId, 12000);

  const order = await orders.getOrder(orderId);
  const sent = await h.send(M(), h.textUpdate(`/ad_${order.targetId}`, u));
  const text = said(sent);
  assert.match(text, /\+998901112233/, "the number is shown");
  assert.match(text, /📞/, "and marked as a phone rather than a link");
  assert.strictEqual(urlButtons(sent).length, 0, "a phone gets no URL button -- Telegram refuses tel:");
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
