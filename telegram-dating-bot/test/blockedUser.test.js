// Someone blocking the bot is an ordinary event, and it used to be handled
// as a crash.
//
// The reported failure, verbatim from production:
//   403: Forbidden: bot was blocked by the user
//     at Object.media (src/scenes/profileWizard.js:156)
//   -> 🚨 Main bot error on my_chat_member
//
// Two faults, one behind the other. Blocking the bot sends a my_chat_member
// update; while the registration form is open the stage middleware routes
// EVERY update into the current step, so that block event was read as an
// answer to "send me your photo", found no photo, and tried to reply to the
// very person who had just blocked us. And the 403 that came back was then
// alerted on -- which on a busy day means one 🚨 per person who ever walks
// away, burying every real crash underneath them.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Alerts are OFF by default in the harness; this test is specifically about
// what does and does not get alerted, so it needs them on.
process.env.ALERT_CHAT_ID = "424242";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const ROOT = path.join(__dirname, "..");
const Telegram = require(path.join(ROOT, "node_modules/telegraf/lib/telegram.js")).default;

const h = require("./harness");
const db = require("../src/db");

const M = () => h.mainBot();

let nextId = 990000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

// What Telegram actually delivers when somebody blocks the bot.
const blockUpdate = (from) => ({
  update_id: Math.floor(Math.random() * 1e6),
  my_chat_member: {
    chat: { id: from.id, type: "private" },
    from,
    date: Math.floor(Date.now() / 1000),
    old_chat_member: { user: { id: 111, is_bot: true }, status: "member" },
    new_chat_member: { user: { id: 111, is_bot: true }, status: "kicked" },
  },
});

// Makes every outbound send to one particular chat fail exactly the way
// Telegram fails once that person has blocked the bot.
function blockOutboundTo(userId) {
  const original = Telegram.prototype.callApi;
  Telegram.prototype.callApi = async function (method, payload = {}) {
    if (String(payload?.chat_id) === String(userId) && /^send/.test(method)) {
      const err = new Error("403: Forbidden: bot was blocked by the user");
      err.response = { error_code: 403, description: "Forbidden: bot was blocked by the user" };
      err.code = 403;
      throw err;
    }
    return original.call(this, method, payload);
  };
  return () => {
    Telegram.prototype.callApi = original;
  };
}

const alertsSent = (calls) => calls.filter((c) => String(c.payload.chat_id) === "424242");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("blocking the bot mid-registration is not answered at all", async () => {
  const u = user("Quitter");

  // Get as far as the photo step, which is where production hit this.
  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate("Quitter", u));
  await h.send(M(), h.textUpdate("22", u));
  await h.send(M(), h.callbackUpdate("gender:male", u));

  // ...and block instead of sending a photo.
  const onBlock = await h.send(M(), blockUpdate(u));

  const toThem = onBlock.filter((c) => String(c.payload.chat_id) === String(u.id));
  assert.deepStrictEqual(
    toThem.map((c) => c.method),
    [],
    `a block event must not be read as an answer to the form -- it tried: ${JSON.stringify(toThem.map((c) => c.method))}`
  );
});

test("a 403 from someone who blocked the bot never pages the operator", async () => {
  const u = user("Gone");

  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));

  // They block, and only now does the bot try to send them something.
  const restore = blockOutboundTo(u.id);
  let calls;
  try {
    calls = await h.send(M(), h.textUpdate("Gone", u));
  } finally {
    restore();
  }

  assert.deepStrictEqual(
    alertsSent(calls).map((c) => c.payload.text),
    [],
    "a blocked bot is expected, not a crash -- it must not raise an alert"
  );
});

test("...and the block is written down, so win-back stops chasing them", async () => {
  // A REGISTERED user, because that is who win-back actually targets -- and
  // the only case where there is a profile row to flag at all.
  const u = user("Lost");
  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate("Lost", u));
  await h.send(M(), h.textUpdate("25", u));
  await h.send(M(), h.callbackUpdate("gender:male", u));
  await h.send(M(), h.photoUpdate(u));
  await h.send(M(), h.textUpdate("Toshkent", u));
  await h.send(M(), h.textUpdate("Salom", u));
  await h.send(M(), h.contactUpdate("+998900001234", u));
  await h.send(M(), h.textUpdate("✅ Ha", u));
  assert.ok(await db.getProfile(u.id), "registered, so there is a row to flag");

  const restore = blockOutboundTo(u.id);
  try {
    await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", u));
  } finally {
    restore();
  }
  // bot.catch records it without awaiting, so give that write a tick.
  await new Promise((r) => setTimeout(r, 50));

  const profile = await db.getProfile(u.id);
  assert.ok(profile?.botBlocked, "the account must be flagged as unreachable");
});

// The alerting path must still work -- silencing 403 is a targeted change,
// not a blanket "stop telling me about errors".
test("a REAL error still raises an alert", async () => {
  const u = user("Breaker");
  const original = Telegram.prototype.callApi;
  Telegram.prototype.callApi = async function (method, payload = {}) {
    if (String(payload?.chat_id) === String(u.id) && /^send/.test(method)) {
      const err = new Error("500: Internal Server Error");
      err.response = { error_code: 500, description: "Internal Server Error" };
      err.code = 500;
      throw err;
    }
    return original.call(this, method, payload);
  };

  let calls;
  try {
    calls = await h.send(M(), h.commandUpdate("/start", u));
  } finally {
    Telegram.prototype.callApi = original;
  }

  assert.ok(
    alertsSent(calls).length > 0,
    "a genuine failure must still reach the operator -- otherwise this fix went too far"
  );
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
