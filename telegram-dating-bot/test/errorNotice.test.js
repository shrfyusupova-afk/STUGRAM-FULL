// When something breaks, say so.
//
// A handler that throws used to produce total silence: the tap registers, the
// error is logged, an alert goes to the operator -- and the person who tapped
// sees nothing at all. From their side that is indistinguishable from a button
// that was never wired up, so it gets reported as "the Premium button doesn't
// work", and whoever investigates goes looking at the button instead of at the
// thing that actually failed.
//
// One sentence turns a dead button into a retry, and turns a misleading bug
// report into an accurate one.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const floodGuard = require("../src/floodGuard");
const { t } = require("../src/i18n");

function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const M = () => h.mainBot();

let nextId = 970000;
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

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let person;

test("setup: somebody using the bot", async () => {
  person = user("Unlucky");
  await register(person, { gender: "male", name: "Unlucky" });
});

// The premium paywall is the screen this was actually reported on, so it is
// the screen the test drives. The first reply is made to fail; the notice
// that follows is what the person must end up seeing.
test("a handler that fails still answers the person", async () => {
  h.failApi((method, payload) =>
    method === "sendMessage" && /Premium obuna/.test(payload.text || "") ? "Bad Request: simulated" : null
  );
  try {
    const sent = await h.send(M(), h.textUpdate("💎 Premium", person));
    assert.match(said(sent), /Kutilmagan xatolik/, "the person must be told something went wrong");
  } finally {
    h.failApi(null);
  }
});

test("the notice tells them to try again rather than just naming a fault", () => {
  for (const lang of ["uz", "ru", "en"]) {
    const text = t(lang, "unexpectedError");
    assert.ok(text && text.length > 20, `${lang} is missing a notice`);
    assert.match(text, /urinib|Попробуйте|try again/i, `${lang} must invite a retry`);
  }
});

// The whole point is that the tap stops looking like nothing happened. If the
// bot stays silent this assertion is what catches it.
test("silence is no longer an acceptable outcome of a failed tap", async () => {
  h.failApi((method, payload) =>
    method === "sendMessage" && /Premium obuna/.test(payload.text || "") ? "Bad Request: simulated" : null
  );
  try {
    const sent = await h.send(M(), h.textUpdate("💎 Premium", person));
    const delivered = sent.filter((c) => c.method === "sendMessage" && !/Premium obuna/.test(c.payload.text || ""));
    assert.ok(delivered.length > 0, "at least one message must actually reach them");
  } finally {
    h.failApi(null);
  }
});

// Somebody who blocked the bot is not an error to report -- every send to them
// fails from then on, and a notice would just be a second failed send. That
// path must stay silent, or a busy day becomes thousands of pointless calls.
test("a blocked user is still handled silently", async () => {
  const gone = user("Blocked");
  await register(gone, { gender: "male", name: "Blocked" });

  h.failApi((method, payload) =>
    method === "sendMessage" && String(payload.chat_id) === String(gone.id)
      ? "403: Forbidden: bot was blocked by the user"
      : null
  );
  try {
    const sent = await h.send(M(), h.textUpdate("💎 Premium", gone));
    const notices = sent.filter((c) => /Kutilmagan xatolik/.test(c.payload.text || ""));
    assert.strictEqual(notices.length, 0, "no notice may be attempted for a blocked user");
  } finally {
    h.failApi(null);
  }
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
