// Telling somebody their Premium is ending, before it does.
//
// The failure this exists to prevent is silence: a subscription that stops
// working with no warning is felt as something taken away. The failure it
// could EASILY introduce is the opposite -- the same reminder every hour
// until the person mutes the bot. So most of what is checked here is that
// each of the four messages goes out exactly once, and that renewing puts
// the whole cycle back to the start.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const floodGuard = require("../src/floodGuard");
const reminder = require("../src/premiumReminder");
const { daysLeft, markFor, composeMessage } = reminder.__test;

function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const M = () => h.mainBot();
const DAY = 24 * 60 * 60 * 1000;

let nextId = 870000;
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

// force: these run at whatever hour the CI clock says, and the sending window
// is a separate concern with its own test.
async function sweep() {
  const before = h.calls.length;
  await reminder.runOnce(M().telegram, { force: true });
  return h.calls.slice(before);
}

const toUser = (sent, u) =>
  sent.filter((c) => c.method === "sendMessage" && String(c.payload.chat_id) === String(u.id));
const textOf = (calls) => calls.map((c) => c.payload.text || "").join("\n");

// Puts a subscription a given number of days from ending.
async function setPremiumDaysOut(u, days) {
  await db.setPremiumUntil(u.id, new Date(Date.now() + days * DAY).toISOString());
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- which message is due --------------------------------------------------

// The ladder, on its own. Six days left must be the WEEK message and not the
// five-day one: the mark is the smallest bucket the remaining days still fit
// inside, so somebody who was away when the week moment passed still hears
// about five days rather than a week that has already gone.
test("the right message is chosen for every number of days left", () => {
  for (const [left, want] of [
    [30, null], [10, null], [8, null],
    [7, 7], [6, 7],
    [5, 5], [4, 5],
    [3, 3], [2, 3], [1, 3],
    [0, 0], [-1, 0], [-5, 0],
  ]) {
    assert.strictEqual(markFor(left), want, `markFor(${left})`);
  }
});

// Rounded UP: with 2.4 days to go a person thinks "three days", and the
// message that says three days must not arrive on the day it is really two.
test("days left is rounded up, the way a person counts", () => {
  const now = Date.now();
  assert.strictEqual(daysLeft(new Date(now + 2.4 * DAY).toISOString(), now), 3);
  assert.strictEqual(daysLeft(new Date(now + 3 * DAY).toISOString(), now), 3);
  assert.strictEqual(daysLeft(new Date(now + 0.1 * DAY).toISOString(), now), 1);
  assert.strictEqual(daysLeft(new Date(now - 0.5 * DAY).toISOString(), now), -0);
  assert.strictEqual(daysLeft("not a date", now), null, "an unreadable date says so");
});

// The whole point of the wording. These are notes from a person, not invoices.
test("all four messages exist in all three languages, and say what is left", () => {
  for (const lang of ["uz", "ru", "en"]) {
    for (const mark of [7, 5, 3, 0]) {
      const text = composeMessage(lang, mark, "Dilshod");
      assert.ok(text && text.length > 20, `${lang}/${mark} should say something`);
      assert.match(text, /Dilshod/, `${lang}/${mark} should use their name`);
    }
    // The numbers have to match the moment they are sent at, or the message
    // is worse than none.
    assert.match(composeMessage(lang, 5, "X"), /5/, `${lang}: the five-day message says five`);
    assert.match(composeMessage(lang, 3, "X"), /3/, `${lang}: the three-day message says three`);
  }
});

// --- through the real database ---------------------------------------------

test("nobody is bothered while their subscription is nowhere near ending", async () => {
  const u = user("Fresh");
  await register(u, { gender: "male", name: "Fresh" });
  await setPremiumDaysOut(u, 25);

  const sent = await sweep();
  assert.strictEqual(toUser(sent, u).length, 0, "25 days out is not a reminder moment");
});

// The core sequence: four messages over the last week, each exactly once,
// however many times the sweeper runs in between.
test("each of the four messages is sent once, and never repeated", async () => {
  const u = user("Countdown");
  await register(u, { gender: "male", name: "Countdown" });

  const seen = [];
  for (const [days, expect] of [[7, true], [6, false], [5, true], [4, false], [3, true], [2, false], [1, false], [0, true]]) {
    await setPremiumDaysOut(u, days);

    // Swept twice at every step: the second run must be silent, which is what
    // proves the marker is doing its job rather than the timing.
    const first = toUser(await sweep(), u);
    const second = toUser(await sweep(), u);

    assert.strictEqual(second.length, 0, `a second sweep at ${days} days must say nothing`);
    assert.strictEqual(
      first.length,
      expect ? 1 : 0,
      `at ${days} days left expected ${expect ? "a message" : "silence"}, got ${first.length}`
    );
    if (first.length) seen.push(textOf(first));
  }

  assert.strictEqual(seen.length, 4, "exactly four messages across the whole week");
  assert.match(seen[0], /hafta/, "the first is the week one");
  assert.match(seen[1], /5 kun/, "then five days");
  assert.match(seen[2], /3 kun/, "then three days");
  assert.match(seen[3], /tugadi/, "and finally that it has ended");
});

// Every message has to carry the way to act on it, or it is just bad news.
test("each reminder carries a renew button", async () => {
  const u = user("Buttoned");
  await register(u, { gender: "male", name: "Buttoned" });
  await setPremiumDaysOut(u, 3);

  const sent = toUser(await sweep(), u);
  assert.strictEqual(sent.length, 1);
  const buttons = (sent[0].payload.reply_markup?.inline_keyboard || []).flat();
  assert.strictEqual(buttons.length, 1, "one button, not a wall of them");
  assert.strictEqual(buttons[0].callback_data, "premium:offer", "and it opens the checkout");
});

// Renewing has to put the whole cycle back to the start. Without the reset,
// somebody who renews after the week message would hear nothing at all next
// month -- the marker would still say "already told them".
test("renewing resets the cycle, so next month speaks again", async () => {
  const u = user("Renewer");
  await register(u, { gender: "male", name: "Renewer" });

  await setPremiumDaysOut(u, 7);
  assert.strictEqual(toUser(await sweep(), u).length, 1, "the week message goes out");

  // They renew: a fresh month from today.
  await setPremiumDaysOut(u, 30);
  await sweep(); // this pass is what clears the marker
  assert.strictEqual(toUser(await sweep(), u).length, 0, "and nothing is said while it is far off");

  // A month later, the same week moment comes round again.
  await setPremiumDaysOut(u, 7);
  assert.strictEqual(toUser(await sweep(), u).length, 1, "the cycle starts over");
});

// Somebody whose Premium lapsed long ago -- before this feature existed, with
// no marker recorded -- must not be told today that it "just ended".
test("a subscription that lapsed long ago is left alone", async () => {
  const u = user("LongGone");
  await register(u, { gender: "male", name: "LongGone" });
  await db.setPremiumUntil(u.id, new Date(Date.now() - 90 * DAY).toISOString());

  assert.strictEqual(toUser(await sweep(), u).length, 0, "90 days ago is not news");
});

// Somebody who has never had Premium has nothing to be reminded about.
test("a user with no subscription is never in the list", async () => {
  const u = user("NeverPaid");
  await register(u, { gender: "male", name: "NeverPaid" });

  assert.strictEqual(toUser(await sweep(), u).length, 0);
});

// Notifications off means off -- this is a marketing message like any other.
test("somebody who muted notifications is not reminded", async () => {
  const u = user("Muted");
  await register(u, { gender: "male", name: "Muted" });
  await db.setNotificationsEnabled(u.id, false);
  await setPremiumDaysOut(u, 3);

  assert.strictEqual(toUser(await sweep(), u).length, 0, "a muted user stays muted");
});

// The sending window: nobody wants this at 4am.
test("nothing is sent outside daytime hours in Tashkent", async () => {
  const { withinSendingHours } = reminder.__test;
  // 04:00 Tashkent is 23:00 UTC the day before.
  assert.strictEqual(withinSendingHours(new Date("2026-08-17T23:00:00.000Z")), false, "4am: no");
  // 14:00 Tashkent is 09:00 UTC.
  assert.strictEqual(withinSendingHours(new Date("2026-08-17T09:00:00.000Z")), true, "2pm: yes");
  // 22:00 Tashkent is 17:00 UTC -- past the window.
  assert.strictEqual(withinSendingHours(new Date("2026-08-17T17:00:00.000Z")), false, "10pm: no");
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
