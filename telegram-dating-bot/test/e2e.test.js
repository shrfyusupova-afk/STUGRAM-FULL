// End-to-end tests against the REAL app: test/harness.js loads src/index.js
// exactly as `npm start` does, then feeds it synthetic Telegram updates and
// records every API call it tries to make. Nothing is re-implemented -- the
// middleware order, the wizard, the handler registration order are all the
// shipped ones, so a change that breaks a button breaks a test here.
//
// Storage is the JSON backend (no DATABASE_URL), writing to data/. Run with
// `npm test`.
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

process.env.CLICK_MERCHANT_ID = "1111";
process.env.CLICK_SERVICE_ID = "2222";
process.env.CLICK_SECRET_KEY = "TOPSECRET";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");

const BASE = "http://127.0.0.1:45999";
const TOKEN = "111:TEST";
const AZIZ = { id: 900001, is_bot: false, first_name: "Aziz", username: "aziz" };
const NILUFAR = { id: 900002, is_bot: false, first_name: "Nilufar", username: "nilufar" };

// Tests must not share people. One test leaving a complaint prompt open, or
// deleting a profile, silently decided whether the next one passed -- which is
// worse than no test, because it fails somewhere other than the broken code.
let nextId = 950000;
function freshUser(name) {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: name.toLowerCase() + nextId };
}
const NEWBIE = { id: 900009, is_bot: false, first_name: "Yangi", username: "yangi" };
const ADMIN = { id: 700001, is_bot: false, first_name: "Admin", username: "boss" };
const STRANGER = { id: 700002, is_bot: false, first_name: "Hacker", username: "hx" };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// chat_id comes back as a number from ctx.reply and as a string from the
// code paths that pass a stored id straight through. Comparing with === was
// a test bug that read exactly like a missing notification.
const toUser = (call, user) => String(call.payload.chat_id) === String(user.id);

// Candidates are picked at random, so "browse and like" cannot assume who is
// on screen. Skip past anyone else until the person under test shows up.
async function browseTo(viewer, name, limit = 25) {
  let sent = await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", viewer));
  for (let i = 0; i < limit; i++) {
    const card = sent.find((c) => c.method === "sendPhoto");
    if (card && (card.payload.caption || "").includes(name)) return card;
    sent = await h.send(M(), h.textUpdate("👎", viewer));
  }
  throw new Error(`never saw ${name} while browsing`);
}

const M = () => h.mainBot();
const A = () => h.adminBot();

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

function inlineData(sent) {
  return sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat()).map((b) => b.callback_data || b.url);
}

async function register(user, { gender = "male", name = "Aziz", location = "Toshkent" } = {}) {
  await h.send(M(), h.commandUpdate("/start", user));
  await h.send(M(), h.callbackUpdate("lang:uz", user));
  await h.send(M(), h.textUpdate(name, user));
  await h.send(M(), h.textUpdate("20", user));
  await h.send(M(), h.callbackUpdate(`gender:${gender}`, user));
  await h.send(M(), h.photoUpdate(user));
  await h.send(M(), h.textUpdate(location, user));
  await h.send(M(), h.textUpdate("Salom", user));
  await h.send(M(), h.contactUpdate("+99890000000" + String(user.id).slice(-1), user));
  return h.send(M(), h.textUpdate("✅ Ha", user));
}

function miniAppInitData(user, { authDate = Math.floor(Date.now() / 1000), token = TOKEN } = {}) {
  const params = { auth_date: String(authDate), query_id: "AA", user: JSON.stringify(user) };
  const dcs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secret).update(dcs).digest("hex");
  return { qs: new URLSearchParams({ ...params, hash }).toString(), hash };
}

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

// --- runner ------------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- registration ------------------------------------------------------------
test("a new user can register and lands on the main menu", async () => {
  const done = await register(AZIZ, { gender: "male", name: "Aziz" });
  assert.match(said(done), /Xush kelibsiz ForOne oilasiga/, "a fresh registration gets the welcome pitch, not a data dump");
  const rows = done.flatMap((c) => c.payload.reply_markup?.keyboard || []);
  const labels = rows.flat().map((b) => b.text || b);
  assert.deepStrictEqual(labels, [
    "🔍 Yangi tanishuvlar",
    "⚙️ Anketa sozlamalari",
    "💌 Kimlar yoqtirdi",
    "👑 VIP suhbat",
    "💎 Premium",
    "🕵️ Anonim chat",
    "🎁 Do'st taklif qilish",
    "🚨 Shikoyat qilmoqchiman",
  ]);
  // The Mini App is on Telegram's own Menu button, not duplicated here.
  assert.ok(!labels.some((l) => l.includes("kabinet")), "cabinet button must not be in the menu");
});

test("every main menu button answers", async () => {
  await register(NILUFAR, { gender: "female", name: "Nilufar" });
  for (const label of [
    "🔍 Yangi tanishuvlar",
    "⚙️ Anketa sozlamalari",
    "💌 Kimlar yoqtirdi",
    "👑 VIP suhbat",
    "💎 Premium",
    "🕵️ Anonim chat",
    "🎁 Do'st taklif qilish",
    "🚨 Shikoyat qilmoqchiman",
  ]) {
    const sent = await h.send(M(), h.textUpdate(label, AZIZ));
    assert.ok(sent.filter((c) => c.method !== "sendChatAction").length > 0, `"${label}" produced no reply at all`);
  }
});

// This is the bug this file was written for: the stage middleware runs before
// bot.start, so while the form is open every update belongs to the current
// step -- and "/start" was stored as the user's name, with no way out.
test("a slash command is never stored as profile data", async () => {
  await h.send(M(), h.commandUpdate("/start", NEWBIE));
  await h.send(M(), h.callbackUpdate("lang:uz", NEWBIE));
  const restarted = await h.send(M(), h.commandUpdate("/start", NEWBIE));
  assert.match(said(restarted), /Ismingizni kiriting/, "/start must restart the form");

  await h.send(M(), h.textUpdate("Jahongir", NEWBIE));
  const unknown = await h.send(M(), h.commandUpdate("/help", NEWBIE));
  assert.match(said(unknown), /Buyruqlar ishlamaydi/, "an unknown command must be explained, not eaten");

  await h.send(M(), h.textUpdate("25", NEWBIE));
  await h.send(M(), h.callbackUpdate("gender:male", NEWBIE));
  await h.send(M(), h.photoUpdate(NEWBIE));
  await h.send(M(), h.textUpdate("Toshkent", NEWBIE));
  await h.send(M(), h.textUpdate("bio", NEWBIE));
  await h.send(M(), h.contactUpdate("+998900000009", NEWBIE));
  await h.send(M(), h.textUpdate("✅ Ha", NEWBIE));
  const stored = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "profiles.json"), "utf8"));
  assert.strictEqual(stored["900009"].name, "Jahongir");
});

// A location that cannot be placed on a map used to be stored verbatim, so
// somebody mashing a few letters ended up with that as their permanent
// location -- and no card could ever show a distance from it.
test("mashed letters are refused as a location, a real place is accepted", async () => {
  const u = freshUser("Wanderer");
  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate("Wanderer", u));
  await h.send(M(), h.textUpdate("22", u));
  await h.send(M(), h.callbackUpdate("gender:male", u));
  await h.send(M(), h.photoUpdate(u));

  const junk = await h.send(M(), h.textUpdate("asdfgh", u));
  assert.match(said(junk), /topa olmadim/, "junk must be refused with an explanation");

  // Still on the same step -- the form did not move on.
  const stillJunk = await h.send(M(), h.textUpdate("qwerty", u));
  assert.match(said(stillJunk), /topa olmadim/, "a second attempt is still the location step");

  // A real district, however casually spelled, gets through and is stored
  // under its canonical name.
  const ok = await h.send(M(), h.textUpdate("chilanzar", u));
  assert.ok(!/topa olmadim/.test(said(ok)), "a real place must be accepted");

  await h.send(M(), h.textUpdate("Salom", u));
  await h.send(M(), h.contactUpdate("+998900007777", u));
  await h.send(M(), h.textUpdate("✅ Ha", u));

  const profiles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "profiles.json"), "utf8"));
  assert.strictEqual(profiles[String(u.id)].location, "Chilonzor", "stored under one canonical spelling");
});

// The distance is the most useful thing about a stranger's location, and it
// only exists relative to whoever is looking.
test("a profile card shows how far away that person is", async () => {
  const viewer = freshUser("Looker");
  const target = freshUser("Faraway");
  await register(viewer, { gender: "male", name: "Looker", location: "Chilonzor" });
  await register(target, { gender: "female", name: "Faraway", location: "Yunusobod" });

  const card = await browseTo(viewer, "Faraway");
  assert.match(
    card.payload.caption,
    /Yunusobod \(\d+(\.\d+)? km\)/,
    `expected a distance next to the location, got: ${card.payload.caption}`
  );
});

// --- discovery ---------------------------------------------------------------
// Notifications are now milestone-based: nobody is pinged for a single like.
// The dedup rule this case was written for is unchanged and still checked --
// one stored row per pair, no matter how often the button is tapped.
test("a like is stored once and stays quiet below the first milestone", async () => {
  const him = freshUser("Liker");
  const her = freshUser("Liked");
  await register(him, { gender: "male", name: "Liker" });
  await register(her, { gender: "female", name: "Liked" });

  await browseTo(him, "Liked");
  const first = await h.send(M(), h.textUpdate("❤️", him));
  await wait(50);
  assert.ok(
    !first.some((c) => toUser(c, her) && /layk bosdi/.test(c.payload.text || "")),
    "one like is not worth a message"
  );

  const second = await h.send(M(), h.textUpdate("❤️", him));
  assert.ok(
    !second.some((c) => toUser(c, her)),
    "liking the same person again must not notify"
  );
  const likes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "likes.json"), "utf8"));
  assert.deepStrictEqual(likes[String(her.id)], [String(him.id)], "exactly one stored row");
});

// The complaint prompt used to swallow the next thing typed no matter what it
// was, so tapping a menu button filed a complaint whose text was the button's
// own name -- and took the person nowhere.
test("a menu button tapped during the complaint prompt goes where it says", async () => {
  const u = freshUser("Undecided");
  const other = freshUser("Someone");
  await register(u, { gender: "male", name: "Undecided" });
  await register(other, { gender: "female", name: "Someone" });

  await h.send(M(), h.textUpdate("🚨 Shikoyat qilmoqchiman", u));
  const tapped = await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", u));
  assert.ok(tapped.some((c) => c.method === "sendPhoto"), "it must open discovery");
  assert.ok(!/Shikoyat raqami/.test(said(tapped)), "it must not file a complaint");
});

test("profile text is escaped, not rendered as HTML", async () => {
  const evil = freshUser("Evil");
  await h.send(M(), h.commandUpdate("/start", evil));
  await h.send(M(), h.callbackUpdate("lang:uz", evil));
  await h.send(M(), h.textUpdate("<b>X</b><script>alert(1)</script>", evil));
  await h.send(M(), h.textUpdate("22", evil));
  await h.send(M(), h.callbackUpdate("gender:male", evil));
  await h.send(M(), h.photoUpdate(evil));
  await h.send(M(), h.textUpdate("Toshkent", evil));
  await h.send(M(), h.textUpdate("bio", evil));
  await h.send(M(), h.contactUpdate("+99890000" + evil.id, evil));
  await h.send(M(), h.textUpdate("✅ Ha", evil));

  const viewer = freshUser("Viewer");
  await register(viewer, { gender: "female", name: "Viewer" });
  const card = await browseTo(viewer, "script");
  const caption = card.payload.caption || "";
  assert.ok(!caption.includes("<script>"), "raw <script> reached a caption");
  assert.ok(caption.includes("&lt;script&gt;"), "the tag should be escaped, not stripped silently");
});

// --- anonymous chat ----------------------------------------------------------
test("anonymous chat pairs two people and relays both ways", async () => {
  await h.send(M(), h.textUpdate("🕵️ Anonim chat", AZIZ));
  await h.send(M(), h.textUpdate("🎲 Random", AZIZ));
  await h.send(M(), h.textUpdate("🕵️ Anonim chat", NILUFAR));
  const paired = await h.send(M(), h.textUpdate("🎲 Random", NILUFAR));
  assert.strictEqual(paired.filter((c) => /Topildi/.test(c.payload.text || "")).length, 2, "both sides must be told");

  await wait(450); // MIN_RELAY_GAP_MS
  const out = await h.send(M(), h.textUpdate("salom", AZIZ));
  assert.ok(out.some((c) => c.payload.chat_id === NILUFAR.id && c.payload.text === "salom"));

  await wait(450);
  const back = await h.send(M(), h.textUpdate("javob", NILUFAR));
  assert.ok(back.some((c) => c.payload.chat_id === AZIZ.id && c.payload.text === "javob"));

  const ended = await h.send(M(), h.textUpdate("🛑 Suhbatni to'xtatish", AZIZ));
  assert.ok(ended.some((c) => c.payload.chat_id === NILUFAR.id), "the partner must be told the chat ended");
});

test("the gender filter is behind a paywall, random is not", async () => {
  await h.send(M(), h.textUpdate("🕵️ Anonim chat", AZIZ));
  const gated = await h.send(M(), h.textUpdate("👧 Qiz bola bilan", AZIZ));
  assert.match(said(gated), /12 900/, "the price must be shown");
  await h.send(M(), h.textUpdate("⬅️ Orqaga", AZIZ));
});

// --- payments ----------------------------------------------------------------
async function clickPost(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

test("Click activates premium, rejects bad signatures and refuses replays", async () => {
  const buyer = { id: 900004, is_bot: false, first_name: "Buyer", username: "buyer" };
  await register(buyer, { gender: "male", name: "Buyer" });
  const offer = await h.send(M(), h.textUpdate("💎 Premium", buyer));
  const url = inlineData(offer).find((d) => String(d).startsWith("https://"));
  const orderId = new URL(url).searchParams.get("transaction_param");

  const common = {
    click_trans_id: "555",
    service_id: "2222",
    merchant_trans_id: orderId,
    amount: "79900",
    sign_time: "2026-07-31 09:00:00",
  };

  const forged = await clickPost("/click/prepare", { ...common, action: "0", sign_string: md5("garbage") });
  assert.strictEqual(forged.error, -1, "a forged signature must be refused");

  const prepSign = md5(`5552222TOPSECRET${orderId}79900${0}${common.sign_time}`);
  const prep = await clickPost("/click/prepare", { ...common, action: "0", sign_string: prepSign });
  assert.strictEqual(prep.error, 0);

  const mpi = prep.merchant_prepare_id;
  const compSign = md5(`5552222TOPSECRET${orderId}${mpi}79900${1}${common.sign_time}`);
  const before = h.calls.length;
  const done = await clickPost("/click/complete", { ...common, action: "1", merchant_prepare_id: mpi, sign_string: compSign });
  assert.strictEqual(done.error, 0);
  await wait(200);

  const profiles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "profiles.json"), "utf8"));
  assert.ok(profiles[String(buyer.id)].premiumUntil, "premium must switch on by itself after payment");
  assert.ok(
    h.calls.slice(before).some((c) => /Premium faollashtirildi/.test(c.payload.text || "")),
    "the buyer must be told"
  );

  const again = h.calls.length;
  const replay = await clickPost("/click/complete", { ...common, action: "1", merchant_prepare_id: mpi, sign_string: compSign });
  assert.strictEqual(replay.error, -4, "a replayed callback must not pay out twice");
  await wait(200);
  assert.strictEqual(h.calls.slice(again).filter((c) => c.method === "sendMessage").length, 0);
});

// --- Mini App ----------------------------------------------------------------
async function apiState(headers) {
  const res = await fetch(BASE + "/api/state", { headers });
  return res.status;
}

test("the Mini App refuses anything it cannot verify", async () => {
  const now = Math.floor(Date.now() / 1000);
  const { qs, hash } = miniAppInitData(AZIZ);

  assert.strictEqual(await apiState({}), 401, "no initData");
  assert.strictEqual(await apiState({ "x-telegram-init-data": "user=%7B%7D&hash=deadbeef" }), 401, "garbage");
  assert.strictEqual(
    await apiState({ "x-telegram-init-data": miniAppInitData(AZIZ, { token: "999:WRONG" }).qs }),
    401,
    "signed with another bot's token"
  );
  assert.strictEqual(
    await apiState({ "x-telegram-init-data": miniAppInitData(AZIZ, { authDate: now - 172800 }).qs }),
    401,
    "two days stale"
  );

  const flipped = (hash[0] === "a" ? "b" : "a") + hash.slice(1);
  assert.strictEqual(await apiState({ "x-telegram-init-data": qs.replace(hash, flipped) }), 401, "tampered hash");

  const swapped = qs.replace(/user=[^&]*/, "user=" + encodeURIComponent(JSON.stringify({ ...AZIZ, id: 999 })));
  assert.strictEqual(await apiState({ "x-telegram-init-data": swapped }), 401, "payload swapped under a valid hash");

  assert.strictEqual(await apiState({ "x-telegram-init-data": qs }), 200, "a genuine one must work");
});

test("the Mini App prices come from the server, not the request", async () => {
  const { qs } = miniAppInitData(AZIZ);
  for (const type of ["premium", "vipchat", "anongender"]) {
    const res = await fetch(`${BASE}/api/order?type=${type}`, { method: "POST", headers: { "x-telegram-init-data": qs } });
    const body = await res.json();
    assert.strictEqual(res.status, 200, type);
    assert.ok(body.url, `${type} must return a checkout link`);
  }
  const bad = await fetch(`${BASE}/api/order?type=free-please`, { method: "POST", headers: { "x-telegram-init-data": qs } });
  assert.strictEqual(bad.status, 400);
});

test("the webhook rejects updates without the secret token", async () => {
  for (const headers of [{}, { "x-telegram-bot-api-secret-token": "wrong" }]) {
    const res = await fetch(BASE + "/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ update_id: 99, message: { message_id: 1, date: 0, chat: { id: 1, type: "private" }, from: AZIZ, text: "hi" } }),
    });
    assert.strictEqual(res.status, 404, "an unsigned update must not be processed");
  }
});

// --- admin panel -------------------------------------------------------------
async function loginAdmin(user = ADMIN, pin = "13579") {
  await h.send(A(), h.commandUpdate("/start", user));
  await h.send(A(), h.commandUpdate("/iamadmin", user));
  let last;
  for (const d of pin) last = await h.send(A(), h.callbackUpdate(`admin:pin:${d}`, user));
  return last;
}

test("a stranger sees the FAQ screen, not a hint that this is the admin panel", async () => {
  const start = await h.send(A(), h.commandUpdate("/start", STRANGER));
  const text = said(start);
  assert.ok(!/[Kk]od/.test(text), `must not mention the PIN before /iamadmin: "${text}"`);
  const buttons = start.flatMap((c) => c.payload.reply_markup?.keyboard || []).flat().map((b) => b.text || b);
  assert.deepStrictEqual(buttons, ["ForOne - nima?", "ForOne - asoschisi kim?", "ForOne - hizmatlari narxi?"]);

  const answer = await h.send(A(), h.textUpdate("ForOne - hizmatlari narxi?", STRANGER));
  assert.match(said(answer), /so'm/, "an FAQ button must actually answer, not just decorate the screen");

  const revealed = await h.send(A(), h.commandUpdate("/iamadmin", STRANGER));
  assert.match(said(revealed), /Kodni kiriting/, "/iamadmin is the only door into the PIN pad");
});

test("the PIN lockout is per person, so one stranger cannot lock the admins out", async () => {
  await h.send(A(), h.commandUpdate("/start", STRANGER));
  await h.send(A(), h.commandUpdate("/iamadmin", STRANGER));
  for (const d of "00000") await h.send(A(), h.callbackUpdate(`admin:pin:${d}`, STRANGER));
  const blocked = await h.send(A(), h.callbackUpdate("admin:pin:0", STRANGER));
  assert.match(said(blocked), /kuting/, "a wrong PIN must slow that person down");

  const ok = await loginAdmin();
  assert.match(said(ok), /Kod to'g'ri/, "the real admin must still get in");
});

test("admin search lists people and the id opens the card", async () => {
  await h.send(A(), h.textUpdate("👥 Foydalanuvchilar", ADMIN));
  const list = await h.send(A(), h.textUpdate("Aziz", ADMIN));
  assert.match(said(list), /\/u_900001/, "the id must be a tappable command");

  const card = await h.send(A(), h.textUpdate("/u_900001", ADMIN, [{ type: "bot_command", offset: 0, length: 9 }]));
  assert.ok(card.some((c) => c.method === "sendPhoto"), "the card must carry the photo");
  assert.ok(
    card.some((c) => c.method === "sendChatAction"),
    "a chat action must go first -- it is what closes Telegram's webhook request early"
  );
  assert.ok(card.some((c) => c.payload.protect_content === true), "the photo must stay protected in the panel");
});

let deletedUser;
test("admin actions reach the user through the MAIN bot", async () => {
  deletedUser = freshUser("Victim");
  await register(deletedUser, { gender: "male", name: "Victim" });

  const off = await h.send(A(), h.callbackUpdate(`admin:toggle:${deletedUser.id}`, ADMIN));
  assert.ok(
    off.some((c) => c.bot === "main" && toUser(c, deletedUser)),
    "deactivating must tell the user, in the bot they actually use"
  );

  const gone = await h.send(A(), h.callbackUpdate(`admin:delete:${deletedUser.id}`, ADMIN));
  const notice = gone.find((c) => c.bot === "main" && toUser(c, deletedUser));
  assert.ok(notice, "deletion must tell the user");
  const buttons = (notice.payload.reply_markup?.inline_keyboard || []).flat().map((b) => b.callback_data);
  assert.deepStrictEqual(buttons, ["account:new", "account:report"]);
});

test("a deleted user can start over without a broken greeting", async () => {
  await h.send(M(), h.callbackUpdate("account:new", deletedUser));
  const greeting = await h.send(M(), h.callbackUpdate("lang:uz", deletedUser));
  const text = said(greeting);
  assert.ok(!/undefined/.test(text), `greeting contained "undefined": ${text.slice(0, 120)}`);
  assert.match(text, /Ismingizni kiriting/);
});

test("a complaint reaches the admin and the answer comes back", async () => {
  const reporter = freshUser("Reporter");
  await register(reporter, { gender: "female", name: "Reporter" });
  await h.send(M(), h.textUpdate("🚨 Shikoyat qilmoqchiman", reporter));
  await h.send(M(), h.textUpdate("Bu odam yolg'on gapiryapti", reporter));

  const list = await h.send(A(), h.textUpdate("🚨 Shikoyatlar", ADMIN));
  const id = /<code>(\d+)<\/code>/.exec(said(list))?.[1];
  assert.ok(id, "the complaint must be listed");

  await h.send(A(), h.textUpdate(id, ADMIN));
  const answered = await h.send(A(), h.textUpdate("Tekshirdik, rahmat", ADMIN));
  assert.ok(
    answered.some((c) => c.bot === "main" && toUser(c, reporter) && /Tekshirdik/.test(c.payload.text || "")),
    "the reporter must receive the answer"
  );

  // The cursor must clear, or every later message is swallowed as another reply.
  const after = await h.send(A(), h.textUpdate("Reporter", ADMIN));
  assert.match(said(after), /topildi|Hech kim topilmadi/, "the panel must be usable again straight after answering");
});

test("logging out really ends the session", async () => {
  const out = await h.send(A(), h.textUpdate("🚪 Admin bo'lishdan chiqish", ADMIN));
  assert.match(said(out), /chiqdingiz/);
  const blocked = await h.send(A(), h.textUpdate("📊 Statistika", ADMIN));
  assert.match(said(blocked), /kodni qayta kiriting|Kodni kiriting/, "the panel must ask for the PIN again");
});

// --- go ----------------------------------------------------------------------
(async () => {
  await wait(1000); // storage + express listen
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
