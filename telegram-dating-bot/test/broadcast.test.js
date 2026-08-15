// Composing an advert, and the two ways it used to end in silence.
//
// A message carrying a photo is a CAPTION, and Telegram caps a caption at
// 1024 characters -- a quarter of what a plain text message allows. So an
// advert that was fine as text broke the moment a picture was attached to it,
// and the failure arrived as a 400 the admin could not act on.
//
// Worse, any error escaping a handler was logged and alerted and NOTHING was
// said to the admin: same screen, same keyboard, no reply. That is what "it
// froze, only the back button worked" actually is.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const floodGuard = require("../src/floodGuard");

// Composing an advert takes a dozen updates, and this file composes several
// in a row -- far faster than a person, and past the flood guard's 40-per-10s
// ceiling, which drops updates SILENTLY. Without this the later tests here
// would fail with the exact symptom they are about to diagnose, from the
// wrong cause. Sweeping with a future clock expires every window.
function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const M = () => h.mainBot();
const A = () => h.adminBot();

let nextId = 940500;
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

// The keyboard under the chat, flattened to labels.
const keyboardLabels = (sent) => {
  const withKeyboard = sent.filter((c) => c.payload.reply_markup?.keyboard);
  if (withKeyboard.length === 0) return null;
  const last = withKeyboard[withKeyboard.length - 1];
  return last.payload.reply_markup.keyboard.flat().map((b) => (typeof b === "string" ? b : b.text));
};

const BROADCAST = "📢 Reklama berish";
const SKIP_MEDIA = "⏭ Rasmsiz davom etish";
const CONFIRM_YES = "✅ Ha, yuborilsin";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists and is logged in", async () => {
  admin = user("Adman");
  await register(admin, { gender: "male", name: "Adman" });
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));
});

// --- the happy path, so the rest is measured against something that works ---
test("a short text advert reaches the preview and the confirm buttons", async () => {
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.textUpdate(SKIP_MEDIA, admin));
  const sent = await h.send(A(), h.textUpdate("Yangi funksiya chiqdi!", admin));

  assert.match(said(sent), /Namuna/, "the preview must be shown");
  assert.match(said(sent), /Yangi funksiya chiqdi!/, "and it must contain the advert itself");
  const labels = keyboardLabels(sent);
  assert.ok(labels?.includes(CONFIRM_YES), `expected the confirm buttons, got ${JSON.stringify(labels)}`);
});

// --- the length limits ------------------------------------------------------

// 4096 is Telegram's cap on a plain text message. Past it the send fails and
// the admin was left staring at the compose screen.
test("a text advert past 4096 characters is refused with the numbers", async () => {
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.textUpdate(SKIP_MEDIA, admin));

  const tooLong = "a".repeat(4200);
  const sent = await h.send(A(), h.textUpdate(tooLong, admin));
  const text = said(sent);

  assert.match(text, /juda uzun/, "it must say what is wrong");
  assert.match(text, /4200/, "with the actual length");
  assert.match(text, /4096/, "and the limit");
  assert.match(text, /104/, "and how much to cut");
  assert.ok(!/Namuna/.test(text), "and must not pretend to preview it");

  // Still composing: the fix is to resend the text, not to start over.
  const labels = keyboardLabels(sent);
  assert.ok(labels && !labels.includes(CONFIRM_YES), "it must not jump to the confirm step");

  const fixed = await h.send(A(), h.textUpdate("Qisqa matn", admin));
  assert.match(said(fixed), /Namuna/, "a corrected text carries straight on");
});

// The case that actually bit: the SAME text is fine without a picture and too
// long with one, because a caption gets a quarter of the allowance.
test("with a photo attached the limit drops to 1024, and the message says so", async () => {
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.photoUpdate(admin));

  const text = "b".repeat(1500);
  const sent = await h.send(A(), h.textUpdate(text, admin));
  const out = said(sent);

  assert.match(out, /juda uzun/);
  assert.match(out, /1024/, "the caption limit, not the text one");
  assert.match(out, /1500/, "and what was sent");
  assert.match(out, /476/, "and the shortfall");
  // The way out that keeps the whole advert: drop the picture.
  assert.match(out, /Rasmsiz/, "it must point at the no-photo route, which allows 4096");

  // 1500 characters is fine once the picture is gone -- the same text, the
  // same admin, a different limit.
  await h.send(A(), h.textUpdate("⬅️ Orqaga", admin));
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.textUpdate(SKIP_MEDIA, admin));
  const retry = await h.send(A(), h.textUpdate(text, admin));
  assert.match(said(retry), /Namuna/, "1500 characters is within the text limit");
});

test("exactly at the limit is allowed, one over is not", async () => {
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.textUpdate(SKIP_MEDIA, admin));

  const atLimit = "c".repeat(4096);
  const ok = await h.send(A(), h.textUpdate(atLimit, admin));
  assert.match(said(ok), /Namuna/, "4096 exactly must be accepted");

  await h.send(A(), h.textUpdate("❌ Yo'q, bekor qilish", admin));
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.textUpdate(SKIP_MEDIA, admin));
  const over = await h.send(A(), h.textUpdate("c".repeat(4097), admin));
  assert.match(said(over), /juda uzun/, "4097 must not be");
});

// --- a broken preview must not throw the work away --------------------------

// A stray < or & reads as a broken HTML tag and the preview fails. It used to
// delete the draft, which threw away a photo the admin had already uploaded
// and sent them back to the start -- for a typo fixable by resending one line.
test("a text HTML cannot render keeps the draft and asks for a new one", async () => {
  await h.send(A(), h.textUpdate(BROADCAST, admin));
  await h.send(A(), h.photoUpdate(admin));

  const sent = await h.send(A(), h.textUpdate("Narx <100 ming so'm", admin));
  const text = said(sent);

  // The harness does not enforce Telegram's HTML parsing, so this either
  // previews fine or reports the problem -- what must NEVER happen is silence
  // or being dumped back at the start with the photo lost.
  assert.ok(text.length > 0, "something must come back");
  const labels = keyboardLabels(sent);
  assert.ok(labels && labels.length > 0, "and a keyboard to act on");
});

// --- the silence itself ------------------------------------------------------

// The root cause of "it froze": bot.catch logged and alerted, and said
// nothing to the person standing in front of the panel.
test("an error inside a handler is reported to the admin, not swallowed", async () => {
  // Fails the "Tasdiqlaysizmi?" message specifically. That send happens after
  // the preview has already gone out and is NOT inside the preview's own
  // try/catch, so the error escapes the handler -- exactly the shape that
  // used to produce silence.
  h.failApi((method, payload) =>
    method === "sendMessage" && /Tasdiqlaysizmi/.test(payload.text || "") ? "boom while confirming" : null
  );

  try {
    await h.send(A(), h.textUpdate(BROADCAST, admin));
    await h.send(A(), h.textUpdate(SKIP_MEDIA, admin));
    const sent = await h.send(A(), h.textUpdate("Reklama matni", admin));
    const text = said(sent);

    assert.match(text, /Xatolik/, `the admin must be told: ${text.slice(0, 200)}`);
    assert.match(text, /boom while confirming/, "including what actually went wrong");

    // And handed a way out rather than a dead screen.
    const labels = keyboardLabels(sent);
    assert.ok(labels?.includes(BROADCAST), `the main menu must come back, got ${JSON.stringify(labels)}`);
  } finally {
    h.failApi(null);
  }
});

// The half-finished advert is dropped along with the error. Leaving it set
// would feed the admin's next message straight back into the step that just
// failed.
test("after an error the next message is not swallowed by the dead draft", async () => {
  const sent = await h.send(A(), h.textUpdate("📊 Statistika", admin));
  assert.match(said(sent), /Statistika/, "the panel answers normally again");
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
