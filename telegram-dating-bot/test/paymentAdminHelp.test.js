// Every paywall now says, right under the steps, that a person whose bank
// Click doesn't support is not stuck -- there's a human to write to instead.
// Before this, the only button on a Click-only paywall was the one button
// that might not work for them, and nothing on screen said what to do about
// that.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

process.env.CLICK_MERCHANT_ID = "63267";
process.env.CLICK_SERVICE_ID = "110076";

const h = require("./harness");
const { t } = require("../src/i18n");

const M = () => h.mainBot();

let nextId = 970500;
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

let buyer;

test("setup: somebody who might want to pay", async () => {
  buyer = user("HelpBuyer");
  await register(buyer, { gender: "male", name: "HelpBuyer" });
});

test("the note exists in all three languages and names the admin", () => {
  for (const [lang, handle] of [
    ["uz", "@ForOnebest"],
    ["ru", "@ForOnebest"],
    ["en", "@ForOnebest"],
  ]) {
    const note = t(lang, "paymentAdminHelpNote");
    assert.ok(note && note.length > 10, `${lang} is missing the note`);
    assert.ok(note.includes(handle), `${lang} must name the admin handle`);
    assert.ok(note.includes("Click"), `${lang} must mention Click by name`);
  }
});

test("the Premium paywall shows the note under the steps", async () => {
  const text = said(await h.send(M(), h.textUpdate("💎 Premium", buyer)));
  assert.match(text, /adminimizga murojaat qiling @ForOnebest/, "the help note must be on screen");
  // It has to come AFTER the steps, not instead of them.
  const stepsIndex = text.indexOf("To'lovni amalga oshiring");
  const noteIndex = text.indexOf("@ForOnebest");
  assert.ok(stepsIndex >= 0 && noteIndex > stepsIndex, "the note must follow the steps, not replace them");
});

test("the VIP paywall shows the same note", async () => {
  await h.send(M(), h.textUpdate("👑 VIP suhbat", buyer));
  const text = said(await h.send(M(), h.callbackUpdate("vip:pay:choose", buyer)));
  assert.match(text, /@ForOnebest/, "the VIP paywall must carry the same note");
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
