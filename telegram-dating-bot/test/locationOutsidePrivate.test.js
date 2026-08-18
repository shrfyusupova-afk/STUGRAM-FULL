// "400: Bad Request: location can be requested in private chats only"
//
// Telegram refuses a sendMessage carrying a location-request button OUTSIDE
// a private chat -- and refuses the WHOLE call, not just the button. Since
// telegraf's session is keyed by from.id + chat.id, the SAME person typing
// /anketa in the VIP group (where this bot is a member) starts a brand-new
// registration IN that group rather than continuing their DM one -- and the
// wizard's location step used to crash every time it got there, for anyone
// who ever reaches this step outside a private chat.
//
// The fix keeps the step alive everywhere: the one-tap "share location"
// button only appears in a private chat; typing a place name in always works,
// in a group exactly as in a DM.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");

const M = () => h.mainBot();
const GROUP = { id: -100123456789, type: "supergroup" };

let nextId = 950000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

const keyboardLabels = (sent) => {
  const out = [];
  for (const c of sent) {
    const kb = c.payload.reply_markup?.keyboard;
    if (kb) for (const row of kb) for (const btn of row) out.push(btn.text || btn.request_location || "");
  }
  return out;
};

const hasLocationButton = (sent) =>
  sent.some((c) =>
    (c.payload.reply_markup?.keyboard || []).some((row) => row.some((btn) => btn.request_location))
  );

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Walks the wizard up to (and including) the location step's own prompt,
// entirely inside `chat` -- a group, in the cases below.
async function reachLocationStep(u, chat) {
  await h.send(M(), h.commandUpdate("/start", u, chat));
  await h.send(M(), h.callbackUpdate("lang:uz", u, chat));
  await h.send(M(), h.textUpdate("GroupUser", u, undefined, chat));
  await h.send(M(), h.textUpdate("22", u, undefined, chat));
  await h.send(M(), h.callbackUpdate("gender:male", u, chat));
  return h.send(M(), h.photoUpdate(u, chat));
}

test("the location prompt does not crash in a group chat", async () => {
  const u = user("GroupPerson");
  const sent = await reachLocationStep(u, GROUP);
  // This is the exact call that used to throw "400: location can be
  // requested in private chats only" and take the whole update down with it.
  assert.match(said(sent), /manzil|joylashuv|Manzilingiz|lokatsiya/i, "the location prompt must actually arrive");
});

test("no location-request button is offered outside a private chat", async () => {
  const u = user("GroupPerson2");
  const sent = await reachLocationStep(u, GROUP);
  assert.ok(!hasLocationButton(sent), "Telegram would reject this button outside a DM");
});

test("typing a place name still works, in a group exactly as in a DM", async () => {
  const u = user("GroupPerson3");
  await reachLocationStep(u, GROUP);
  const sent = await h.send(M(), h.textUpdate("Toshkent", u, undefined, GROUP));
  // Advancing past location means the bio prompt is next -- proof the typed
  // location was accepted rather than the step being stuck.
  assert.match(said(sent), /bio|o'zingiz haqingizda|haqida/i, "the wizard must move on to the next step");
});

test("the one-tap button is still offered normally in a private chat", async () => {
  const u = user("DMPerson");
  const sent = await reachLocationStep(u, { id: u.id, type: "private" });
  assert.ok(hasLocationButton(sent), "the convenience button must not be lost for real DM users");
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
