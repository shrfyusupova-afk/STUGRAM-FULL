// The referral reward, driven through the real bot.
//
// What is actually being protected here is a payout: three invited people buy
// one free profile unlock, and a profile unlock is a thing that otherwise
// costs money. So most of these cases are not "does the happy path work" but
// "can somebody manufacture credits" -- clicking your own link, bringing in
// people who already exist, replaying the same invitee, spending one credit
// twice.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Set BEFORE the harness loads src/index.js: click.js reads these at require
// time, and without them every "pay" button degrades to a "not configured
// yet" callback instead of a real checkout URL -- a different screen from
// the one users actually see.
process.env.CLICK_MERCHANT_ID = "1111";
process.env.CLICK_SERVICE_ID = "2222";
process.env.CLICK_SECRET_KEY = "TOPSECRET";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const {
  REFERRALS_PER_CREDIT,
  referrerFromPayload,
  invitesUntilNextCredit,
  registerReferralClick,
} = require("../src/referral");
const db = require("../src/db");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const M = () => h.mainBot();

let nextId = 970000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

const toUser = (call, u) => String(call.payload.chat_id) === String(u.id);

// Registration, optionally arriving through somebody's invite link.
async function register(u, { gender = "male", name = "Test", referrerId = null } = {}) {
  const start = referrerId ? `/start ref_${referrerId}` : "/start";
  await h.send(M(), h.commandUpdate(start, u));
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

// Walks a whole invited person through signing up, and hands back everything
// the bot sent while doing it -- which is where the referrer's notification
// shows up.
async function inviteAndComplete(referrer, name) {
  const invitee = user(name);
  const before = h.calls.length;
  await register(invitee, { gender: "female", name, referrerId: referrer.id });
  return { invitee, sent: h.calls.slice(before) };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- payload parsing ---------------------------------------------------------
test("only a well-formed ref_ payload is accepted", () => {
  assert.strictEqual(referrerFromPayload("ref_12345"), "12345");
  assert.strictEqual(referrerFromPayload("unlock_12345"), null, "another feature's deep link");
  assert.strictEqual(referrerFromPayload("policy"), null);
  assert.strictEqual(referrerFromPayload("ref_"), null, "empty id");
  assert.strictEqual(referrerFromPayload("ref_abc"), null, "non-numeric id");
  assert.strictEqual(referrerFromPayload("ref_1;DROP TABLE"), null, "injected text");
  assert.strictEqual(referrerFromPayload("ref___proto__"), null);
  assert.strictEqual(referrerFromPayload(undefined), null);
  assert.strictEqual(referrerFromPayload({}), null, "a non-string payload");
});

test("the countdown to the next credit is right", () => {
  assert.strictEqual(invitesUntilNextCredit(0), 3);
  assert.strictEqual(invitesUntilNextCredit(1), 2);
  assert.strictEqual(invitesUntilNextCredit(2), 1);
  assert.strictEqual(invitesUntilNextCredit(3), 3, "a fresh countdown starts after a payout");
});

// --- the reward itself -------------------------------------------------------
test(`${REFERRALS_PER_CREDIT} completed invites earn exactly one free unlock`, async () => {
  const host = user("Host");
  await register(host, { gender: "male", name: "Host" });
  assert.strictEqual(await db.getUnlockCredits(host.id), 0, "nobody starts with credits");

  for (let i = 1; i <= REFERRALS_PER_CREDIT - 1; i++) {
    const { sent } = await inviteAndComplete(host, `Friend${i}`);
    assert.strictEqual(await db.getUnlockCredits(host.id), 0, `no credit yet after ${i}`);
    assert.ok(
      sent.some((c) => toUser(c, host) && new RegExp(`\\(${i}/${REFERRALS_PER_CREDIT}\\)`).test(c.payload.text || "")),
      `the referrer should see ${i}/${REFERRALS_PER_CREDIT} progress, not just "someone joined"`
    );
  }

  const { sent } = await inviteAndComplete(host, "Friend3");
  assert.strictEqual(await db.getUnlockCredits(host.id), 1, "the third invite pays out");
  assert.ok(
    sent.some((c) => toUser(c, host) && /bepul anketa ochish/.test(c.payload.text || "")),
    "the referrer should be told they earned it"
  );
  assert.ok(
    sent.some((c) => toUser(c, host) && new RegExp(`\\(${REFERRALS_PER_CREDIT}/${REFERRALS_PER_CREDIT}\\)`).test(c.payload.text || "")),
    "the payout message should show the completed 3/3, not hide the count"
  );

  // And it keeps working: three more, one more credit. Not four.
  for (let i = 4; i <= 6; i++) await inviteAndComplete(host, `Friend${i}`);
  assert.strictEqual(await db.getUnlockCredits(host.id), 2);
});

// A credit earned at 3/3 sits unspent until the referrer chooses to use it.
// The next progress update after that must not just restart the counter at
// "1/3" as if nothing happened -- it has to remind them the earlier credit
// is still there, or it is easy to forget a free unlock exists at all.
test("a progress update after earning a credit reminds you it is still unspent", async () => {
  const host = user("Reminder");
  await register(host, { gender: "male", name: "Reminder" });
  for (let i = 1; i <= REFERRALS_PER_CREDIT; i++) await inviteAndComplete(host, `Rw${i}`);
  assert.strictEqual(await db.getUnlockCredits(host.id), 1, "the third invite already paid out");

  const { sent } = await inviteAndComplete(host, "Rw4");
  const text = sent.find((c) => toUser(c, host))?.payload.text || "";
  assert.match(text, /\(1\/3\)/, "the next cycle's progress restarts at 1, not carrying the old total");
  assert.match(text, /allaqachon.*1 ta.*bepul profil ochish imkoniyati bor/, "and it must not let the unspent credit go unmentioned");
});

test("the reward waits for a COMPLETED anketa, not the click", async () => {
  const host = user("Waiter");
  await register(host, { gender: "male", name: "Waiter" });

  // Clicks the link, starts the form, walks away before the phone step.
  const halfway = user("Halfway");
  await h.send(M(), h.commandUpdate(`/start ref_${host.id}`, halfway));
  await h.send(M(), h.callbackUpdate("lang:uz", halfway));
  await h.send(M(), h.textUpdate("Halfway", halfway));
  await h.send(M(), h.textUpdate("22", halfway));
  await h.send(M(), h.callbackUpdate("gender:female", halfway));

  const pending = await db.getReferral(halfway.id);
  assert.ok(pending, "the click is recorded");
  assert.strictEqual(pending.rewarded, false, "but not paid");

  // Two more who DO finish. If the abandoned one counted, this would pay out.
  await inviteAndComplete(host, "Done1");
  await inviteAndComplete(host, "Done2");
  assert.strictEqual(await db.getUnlockCredits(host.id), 0, "an abandoned signup must not count");
});

// --- abuse -------------------------------------------------------------------
// Checked at the source as well as through the bot. Driving this end-to-end
// alone proves nothing: an unregistered person tapping their own link is
// rejected by the "referrer has no profile" rule before the self-check is
// even reached, so the test passed with the self-check deleted.
test("inviting yourself is refused by name", async () => {
  const registered = user("Selfie");
  await register(registered, { gender: "male", name: "Selfie" });

  assert.strictEqual(
    await registerReferralClick(registered.id, registered.id),
    "self",
    "the same id on both sides is a self-invite, whatever else is true of them"
  );
  assert.strictEqual(await registerReferralClick(String(registered.id), Number(registered.id)), "self", "string vs number");

  // And through the bot: no row, no credit, no matter how often it is tapped.
  await h.send(M(), h.commandUpdate(`/start ref_${registered.id}`, registered));
  await h.send(M(), h.commandUpdate(`/start ref_${registered.id}`, registered));
  assert.strictEqual(await db.getReferral(registered.id), null, "no row for a self-invite");
  assert.strictEqual(await db.getUnlockCredits(registered.id), 0);
});

test("an existing user cannot be invited", async () => {
  const host = user("Host2");
  const old = user("Old");
  await register(host, { gender: "male", name: "Host2" });
  await register(old, { gender: "female", name: "Old" });

  await h.send(M(), h.commandUpdate(`/start ref_${host.id}`, old));
  assert.strictEqual(await db.getReferral(old.id), null, "somebody who already signed up is not an invite");
  assert.strictEqual(await db.getUnlockCredits(host.id), 0);
});

test("an invite from a stranger who has no profile is ignored", async () => {
  const ghostReferrer = 999888777;
  const newbie = user("Newbie");
  await h.send(M(), h.commandUpdate(`/start ref_${ghostReferrer}`, newbie));
  assert.strictEqual(await db.getReferral(newbie.id), null);
});

test("the same invitee cannot be claimed twice", async () => {
  const first = user("First");
  const second = user("Second");
  await register(first, { gender: "male", name: "First" });
  await register(second, { gender: "male", name: "Second" });

  const invitee = user("Contested");
  await h.send(M(), h.commandUpdate(`/start ref_${first.id}`, invitee));
  // A second link, from someone else, before signing up.
  await h.send(M(), h.commandUpdate(`/start ref_${second.id}`, invitee));

  const row = await db.getReferral(invitee.id);
  assert.strictEqual(String(row.referrerId), String(first.id), "the first link wins, permanently");
});

test("finishing the form twice pays only once", async () => {
  const host = user("Once");
  await register(host, { gender: "male", name: "Once" });
  await inviteAndComplete(host, "A1");
  await inviteAndComplete(host, "A2");
  const { invitee } = await inviteAndComplete(host, "A3");
  assert.strictEqual(await db.getUnlockCredits(host.id), 1);

  // The invitee edits their profile -- finish() runs again for the same person.
  await h.send(M(), h.textUpdate("⚙️ Anketa sozlamalari", invitee));
  await h.send(M(), h.textUpdate("✏️ Anketani tahrirlash", invitee));
  await h.send(M(), h.textUpdate("Yangi ism", invitee));
  await h.send(M(), h.textUpdate("23", invitee));
  await h.send(M(), h.callbackUpdate("gender:female", invitee));
  await h.send(M(), h.photoUpdate(invitee));
  await h.send(M(), h.textUpdate("Samarqand", invitee));
  await h.send(M(), h.textUpdate("Yangi bio", invitee));
  await h.send(M(), h.contactUpdate(`+9989${invitee.id}`, invitee));
  await h.send(M(), h.textUpdate("✅ Ha", invitee));

  assert.strictEqual(await db.getUnlockCredits(host.id), 1, "editing a profile must not pay a second time");
});

// --- spending ----------------------------------------------------------------
test("a credit unlocks a profile for free and is then gone", async () => {
  const buyer = user("Buyer");
  await register(buyer, { gender: "male", name: "Buyer" });
  for (let i = 1; i <= REFERRALS_PER_CREDIT; i++) await inviteAndComplete(buyer, `B${i}`);
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 1);

  const target = user("Target");
  await register(target, { gender: "female", name: "Target" });

  // The paywall must offer the free route, not just a price.
  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, buyer));
  assert.match(said(paywall), /bepul ochish imkoniyati bor/, "it should say a free unlock is available");
  const buttons = paywall
    .flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat())
    // The order id in the confirm button is random per order, so compare the
    // callback's shape rather than the id.
    .map((b) => (b.callback_data || "URL").replace(/^payments:done:.+$/, "payments:done"));
  assert.deepStrictEqual(
    buttons,
    ["URL", "payments:done", `unlock:credit:${target.id}`],
    "pay, confirm, then use-free"
  );

  const used = await h.send(M(), h.callbackUpdate(`unlock:credit:${target.id}`, buyer));
  assert.match(said(used), /Bepul imkoniyatdan foydalandingiz/);
  assert.ok(
    used.some((c) => c.method === "sendPhoto" && /📞/.test(c.payload.caption || "")),
    "the phone number should now be visible"
  );
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 0, "the credit is spent");
  assert.strictEqual(await db.hasUnlocked(buyer.id, target.id), true, "and the unlock is recorded");
});

test("tapping the free button twice does not spend two credits", async () => {
  const buyer = user("Double");
  await register(buyer, { gender: "male", name: "Double" });
  for (let i = 1; i <= REFERRALS_PER_CREDIT * 2; i++) await inviteAndComplete(buyer, `D${i}`);
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 2);

  const target = user("Target2");
  await register(target, { gender: "female", name: "Target2" });

  await h.send(M(), h.callbackUpdate(`unlock:credit:${target.id}`, buyer));
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 1);

  // Same button, same profile, again. They already own it, so this must be a
  // free re-open rather than a second charge.
  await h.send(M(), h.callbackUpdate(`unlock:credit:${target.id}`, buyer));
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 1, "re-opening an owned profile is free");
});

// The button on an old message still works months later, long after the
// credit that drew it was spent. Tapping it must refuse, not go negative and
// hand out a free profile forever.
test("the free-unlock button does nothing when the balance is empty", async () => {
  const empty = user("Empty");
  await register(empty, { gender: "male", name: "Empty" });
  const target = user("Target4");
  await register(target, { gender: "female", name: "Target4" });
  assert.strictEqual(await db.getUnlockCredits(empty.id), 0);

  const sent = await h.send(M(), h.callbackUpdate(`unlock:credit:${target.id}`, empty));
  assert.match(said(sent), /Bepul ochish imkoniyati qolmadi/, "it must say there is nothing to spend");
  assert.strictEqual(await db.getUnlockCredits(empty.id), 0, "the balance must not go negative");
  assert.strictEqual(await db.hasUnlocked(empty.id, target.id), false, "and nothing may be unlocked");
  // The paywall is redrawn so they are not left on a dead button.
  assert.match(said(sent), /Bu funksiya pullik/);
});

test("with no credits the paywall offers the two free routes", async () => {
  const broke = user("Broke");
  await register(broke, { gender: "male", name: "Broke" });
  const target = user("Target3");
  await register(target, { gender: "female", name: "Target3" });

  const paywall = await h.send(M(), h.commandUpdate(`/start unlock_${target.id}`, broke));
  const text = said(paywall);
  assert.match(text, /layk bosing/, "waiting for a like back must be offered");
  assert.match(text, /taklif qiling/, "inviting friends must be offered");
  const buttons = paywall
    .flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat())
    // The order id in the confirm button is random per order, so compare the
    // callback's shape rather than the id.
    .map((b) => (b.callback_data || "URL").replace(/^payments:done:.+$/, "payments:done"));
  assert.deepStrictEqual(buttons, ["URL", "payments:done", "referral:show"], "pay, confirm, then invite");

  // And that second button really opens the invite screen.
  const screen = await h.send(M(), h.callbackUpdate("referral:show", broke));
  assert.match(said(screen), /start=ref_/, "the invite link should be shown");
});

test("spending a credit on a deleted profile refunds nothing because it charges nothing", async () => {
  const buyer = user("Careful");
  await register(buyer, { gender: "male", name: "Careful" });
  for (let i = 1; i <= REFERRALS_PER_CREDIT; i++) await inviteAndComplete(buyer, `C${i}`);
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 1);

  const gone = user("Gone");
  await register(gone, { gender: "female", name: "Gone" });
  await db.deleteProfile(gone.id);

  const sent = await h.send(M(), h.callbackUpdate(`unlock:credit:${gone.id}`, buyer));
  assert.match(said(sent), /endi mavjud emas/);
  assert.strictEqual(await db.getUnlockCredits(buyer.id), 1, "the credit must survive");
});

// --- the invite screen -------------------------------------------------------
test("the menu button shows a working link and honest numbers", async () => {
  const sharer = user("Sharer");
  await register(sharer, { gender: "male", name: "Sharer" });
  await inviteAndComplete(sharer, "S1");

  const screen = await h.send(M(), h.textUpdate("🎁 Do'st taklif qilish", sharer));
  const text = said(screen);
  assert.match(text, new RegExp(`start=ref_${sharer.id}`), "the link must carry this person's id");
  assert.match(text, /Taklif qilganlaringiz: <b>1 ta<\/b>/);
  assert.match(text, /Bepul ochish imkoniyati: <b>0 ta<\/b>/);
  assert.match(text, /Keyingi bepul ochishgacha: <b>2 ta<\/b>/);
});

// --- go ----------------------------------------------------------------------
(async () => {
  await wait(1000);
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
