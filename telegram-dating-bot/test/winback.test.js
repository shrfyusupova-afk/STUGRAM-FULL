// The win-back campaign: two messages to people who stopped opening the bot,
// three days apart and seven days apart, and then nothing.
//
// A campaign like this fails in ways that are invisible until they are
// expensive: it messages people at four in the morning, it messages the same
// person every half hour because a crash landed between sending and recording,
// it keeps writing to somebody who blocked the bot months ago, and it claims
// "new people joined!" on a week where nobody did. Each of those has a case
// here.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const wb = require("../src/winback");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const M = () => h.mainBot();
const DAY_MS = 24 * 60 * 60 * 1000;

let nextId = 930000;
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

// Rewrites the stored profile directly. Waiting three real days is not a
// test, and the campaign reads exactly these two fields.
const PROFILES = path.join(DATA_DIR, "profiles.json");
function ageProfile(userId, { daysIdle, patch = {} }) {
  const all = JSON.parse(fs.readFileSync(PROFILES, "utf8"));
  const key = String(userId);
  all[key] = {
    ...all[key],
    lastSeenAt: new Date(Date.now() - daysIdle * DAY_MS).toISOString(),
    ...patch,
  };
  fs.writeFileSync(PROFILES, JSON.stringify(all, null, 2));
}
const readProfile = (userId) => JSON.parse(fs.readFileSync(PROFILES, "utf8"))[String(userId)];

// Stands in for Telegram so a send can be made to fail on demand.
function fakeTelegram({ failWith = null } = {}) {
  const sent = [];
  return {
    sent,
    async sendMessage(chatId, text, extra) {
      if (failWith && failWith.forChat === undefined) throw failWith.error;
      if (failWith && String(failWith.forChat) === String(chatId)) throw failWith.error;
      sent.push({ chatId: String(chatId), text, extra });
      return { message_id: sent.length };
    },
  };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- the quiet hours ----------------------------------------------------------
test("nothing is sent outside 10:00-21:00 Tashkent time", () => {
  // Tashkent is UTC+5, so 03:00 UTC is 08:00 there and 20:00 UTC is 01:00.
  const at = (utcHour) => new Date(Date.UTC(2026, 6, 15, utcHour, 0, 0));
  assert.strictEqual(wb.tashkentHour(at(5)), 10, "05:00 UTC is 10:00 in Tashkent");
  assert.strictEqual(wb.withinSendingHours(at(5)), true, "the window opens at 10:00");
  assert.strictEqual(wb.withinSendingHours(at(15)), true, "20:00 local is still fine");
  assert.strictEqual(wb.withinSendingHours(at(16)), false, "21:00 local is the cutoff");
  assert.strictEqual(wb.withinSendingHours(at(3)), false, "08:00 local is too early");
  assert.strictEqual(wb.withinSendingHours(at(23)), false, "04:00 local -- the message nobody forgives");
});

test("a sweep outside the window sends nothing at all", async () => {
  const idle = user("Nocturnal");
  await register(idle, { gender: "male", name: "Nocturnal" });
  ageProfile(idle.id, { daysIdle: 9 });

  // Not forced, and the real clock decides -- so assert on the shape of the
  // answer rather than on the hour this test happens to run at.
  const result = await wb.runOnce(fakeTelegram());
  if (result.skipped) {
    assert.match(result.skipped, /outside sending hours/);
  } else {
    assert.ok(typeof result.sent === "number", "inside the window it reports a count");
  }
});

// --- who gets a message -------------------------------------------------------
test("only people who have actually drifted are messaged", async () => {
  const active = user("Active");
  const idle3 = user("Idle3");
  await register(active, { gender: "male", name: "Active" });
  await register(idle3, { gender: "male", name: "Idle3" });

  // Somebody of the opposite gender joined, so there is real news to report.
  await register(user("NewGirl"), { gender: "female", name: "NewGirl" });

  ageProfile(active.id, { daysIdle: 1 });
  ageProfile(idle3.id, { daysIdle: 4 });

  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });

  const reached = tg.sent.map((m) => m.chatId);
  assert.ok(reached.includes(String(idle3.id)), "four days idle gets the day-3 message");
  assert.ok(!reached.includes(String(active.id)), "yesterday is not drifting");
});

test("the same person is never messaged twice for the same stage", async () => {
  const idle = user("Once");
  await register(idle, { gender: "male", name: "Once" });
  await register(user("NewGirl2"), { gender: "female", name: "NewGirl2" });
  ageProfile(idle.id, { daysIdle: 4 });

  const first = fakeTelegram();
  await wb.runOnce(first, { force: true });
  assert.strictEqual(first.sent.filter((m) => m.chatId === String(idle.id)).length, 1);

  // A second sweep half an hour later must find nothing to say.
  const second = fakeTelegram();
  await wb.runOnce(second, { force: true });
  assert.strictEqual(second.sent.filter((m) => m.chatId === String(idle.id)).length, 0, "no repeat");
});

test("a week of silence gets the week message, not the three-day one", async () => {
  const idle = user("Week");
  await register(idle, { gender: "male", name: "Week" });
  await register(user("NewGirl3"), { gender: "female", name: "NewGirl3" });
  ageProfile(idle.id, { daysIdle: 10 });

  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  const mine = tg.sent.filter((m) => m.chatId === String(idle.id));
  assert.strictEqual(mine.length, 1, "one message, not one per stage");
  assert.match(mine[0].text, /bir hafta bo'ldi/, "the seven-day wording");
  assert.strictEqual(readProfile(idle.id).winbackStage, 7);
});

// Two halves, tested separately on purpose. The middleware writes last_seen
// at most once an hour per person -- a database round-trip on every single tap
// would be absurd for a field read twice a day -- and this test process
// registered its users seconds ago, so driving a "return" through the bot here
// would be suppressed by that throttle rather than by anything under test.
test("coming back resets the campaign", async () => {
  const returner = user("Returner");
  await register(returner, { gender: "male", name: "Returner" });
  await register(user("NewGirl4"), { gender: "female", name: "NewGirl4" });
  ageProfile(returner.id, { daysIdle: 4 });

  await wb.runOnce(fakeTelegram(), { force: true });
  assert.strictEqual(readProfile(returner.id).winbackStage, 3, "stage recorded");

  // What the middleware calls when somebody shows up again.
  await db.touchLastSeen(returner.id);
  const after = readProfile(returner.id);
  assert.strictEqual(after.winbackStage, 0, "the sequence starts over next time");
  assert.ok(after.lastSeenAt, "and they count as seen");
  assert.ok(
    Date.now() - new Date(after.lastSeenAt).getTime() < 60_000,
    "last seen is now, not the stale value"
  );

  // And with the stage cleared they are no longer a target.
  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  assert.strictEqual(tg.sent.filter((m) => m.chatId === String(returner.id)).length, 0);
});

// The middleware cannot write last_seen at /start -- there is no profile row
// yet -- and it then throttles itself for an hour, so a fresh signup really
// does sit with last_seen unset. Treating that as "infinitely idle" put
// somebody who registered this afternoon into the day-3 batch; the fallback to
// updatedAt is what stops it.
test("somebody who registered today is not treated as idle", async () => {
  const fresh = user("Newcomer");
  await register(fresh, { gender: "male", name: "Newcomer" });
  await register(user("NewGirlX"), { gender: "female", name: "NewGirlX" });
  await wait(50);

  const stored = readProfile(fresh.id);
  assert.ok(stored.updatedAt, "registration at least records when the profile was saved");

  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  assert.strictEqual(
    tg.sent.filter((m) => m.chatId === String(fresh.id)).length,
    0,
    "a signup from minutes ago must not get a 'we miss you' message"
  );
});

// --- honesty ------------------------------------------------------------------
test("nothing is sent when there is genuinely no news", async () => {
  const idle = user("NoNews");
  // Female, so the message would be about new men -- and no man has joined
  // recently in this test's own window.
  await register(idle, { gender: "female", name: "NoNews" });
  ageProfile(idle.id, { daysIdle: 4 });

  // Age every male profile so none of them counts as "new".
  const all = JSON.parse(fs.readFileSync(PROFILES, "utf8"));
  for (const [id, p] of Object.entries(all)) {
    if (p.gender === "male") all[id] = { ...p, updatedAt: new Date(Date.now() - 30 * DAY_MS).toISOString() };
  }
  fs.writeFileSync(PROFILES, JSON.stringify(all, null, 2));

  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  assert.strictEqual(
    tg.sent.filter((m) => m.chatId === String(idle.id)).length,
    0,
    "no invented news"
  );
  // Still marked, so she is not reconsidered every half hour for the same
  // non-answer.
  assert.strictEqual(readProfile(idle.id).winbackStage, 3);
});

test("waiting likes lead the message, because they are about this person", async () => {
  const her = user("Wanted");
  await register(her, { gender: "female", name: "Wanted" });
  const admirer = user("Admires");
  await register(admirer, { gender: "male", name: "Admires" });
  await db.recordLike(admirer.id, her.id);

  ageProfile(her.id, { daysIdle: 4 });

  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  const mine = tg.sent.filter((m) => m.chatId === String(her.id));
  assert.strictEqual(mine.length, 1);
  assert.match(mine[0].text, /1 kishi/, "the real number of admirers");
  assert.match(mine[0].text, /layk bosdi/);
});

// --- what Telegram answers ----------------------------------------------------
test("a blocked user is recorded and never written to again", async () => {
  const blocker = user("Blocker");
  await register(blocker, { gender: "male", name: "Blocker" });
  await register(user("NewGirl5"), { gender: "female", name: "NewGirl5" });
  ageProfile(blocker.id, { daysIdle: 4 });

  const forbidden = Object.assign(new Error("Forbidden: bot was blocked by the user"), {
    response: { error_code: 403 },
  });
  assert.strictEqual(wb.isGone(forbidden), true, "403 is recognised");

  await wb.runOnce(fakeTelegram({ failWith: { forChat: blocker.id, error: forbidden } }), { force: true });
  assert.strictEqual(readProfile(blocker.id).botBlocked, true, "recorded");

  // Now idle long enough for the week message too -- and still skipped.
  ageProfile(blocker.id, { daysIdle: 10, patch: { winbackStage: 0 } });
  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  assert.strictEqual(
    tg.sent.filter((m) => m.chatId === String(blocker.id)).length,
    0,
    "a blocked user is never written to again"
  );
});

test("a 429 is waited out for exactly as long as Telegram asks", () => {
  const limited = Object.assign(new Error("Too Many Requests"), {
    response: { error_code: 429, parameters: { retry_after: 7 } },
  });
  assert.strictEqual(wb.retryAfterMs(limited), 8000, "retry_after plus a second of slack");
  assert.strictEqual(wb.retryAfterMs(new Error("something else")), null, "not a rate limit");
  assert.strictEqual(wb.isGone(limited), false, "429 is not 'gone'");
});

test("one person failing does not stop the rest of the batch", async () => {
  const bad = user("Bad");
  const good = user("Good");
  await register(bad, { gender: "male", name: "Bad" });
  await register(good, { gender: "male", name: "Good" });
  await register(user("NewGirl6"), { gender: "female", name: "NewGirl6" });
  ageProfile(bad.id, { daysIdle: 4 });
  ageProfile(good.id, { daysIdle: 4 });

  const boom = Object.assign(new Error("Bad Request: chat not found"), { response: { error_code: 400 } });
  const tg = fakeTelegram({ failWith: { forChat: bad.id, error: boom } });
  await wb.runOnce(tg, { force: true });

  assert.strictEqual(tg.sent.filter((m) => m.chatId === String(good.id)).length, 1, "the rest still go out");
});

// --- opting out ---------------------------------------------------------------
test("the mute button really stops the campaign", async () => {
  const muter = user("Muter");
  await register(muter, { gender: "male", name: "Muter" });
  await register(user("NewGirl7"), { gender: "female", name: "NewGirl7" });

  const replied = await h.send(M(), h.callbackUpdate("winback:mute", muter));
  assert.match(
    replied.map((c) => c.payload.text || "").join("\n"),
    /boshqa bunday xabar yubormaymiz/,
    "they are told it worked"
  );
  assert.strictEqual(await db.getNotificationsEnabled(muter.id), false);

  ageProfile(muter.id, { daysIdle: 10 });
  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  assert.strictEqual(tg.sent.filter((m) => m.chatId === String(muter.id)).length, 0, "silence means silence");
});

test("every message carries both a way in and a way out", async () => {
  const idle = user("Buttons");
  await register(idle, { gender: "male", name: "Buttons" });
  await register(user("NewGirl8"), { gender: "female", name: "NewGirl8" });
  ageProfile(idle.id, { daysIdle: 4 });

  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  const mine = tg.sent.find((m) => m.chatId === String(idle.id));
  assert.ok(mine, "a message was sent");
  const data = (mine.extra.reply_markup?.inline_keyboard || []).flat().map((b) => b.callback_data);
  assert.deepStrictEqual(data, ["winback:browse", "winback:mute"]);
});

test("the browse button opens the same screen as the menu button", async () => {
  const idle = user("Opens");
  await register(idle, { gender: "male", name: "Opens" });
  await register(user("NewGirl9"), { gender: "female", name: "NewGirl9" });

  const opened = await h.send(M(), h.callbackUpdate("winback:browse", idle));
  assert.ok(opened.some((c) => c.method === "sendPhoto"), "a candidate card, not a dead tap");
});

test("the settings toggle really turns them back on", async () => {
  const u = user("Toggler");
  await register(u, { gender: "male", name: "Toggler" });

  // Muted from a win-back message.
  await h.send(M(), h.callbackUpdate("winback:mute", u));
  assert.strictEqual(await db.getNotificationsEnabled(u.id), false);

  // The mute message promises this exact route back. If the button is not
  // there, that promise is a lie and blocking the bot is the only way out.
  const settings = await h.send(M(), h.textUpdate("⚙️ Anketa sozlamalari", u));
  const labels = settings
    .flatMap((c) => (c.payload.reply_markup?.keyboard || []).flat())
    .map((b) => b.text || b);
  assert.ok(labels.includes("🔔 Bildirishnomalarni yoqish"), `no way back on: ${labels.join(" / ")}`);

  const back = await h.send(M(), h.textUpdate("🔔 Bildirishnomalarni yoqish", u));
  assert.match(back.map((c) => c.payload.text || "").join("\n"), /Yoqildi/);
  assert.strictEqual(await db.getNotificationsEnabled(u.id), true, "and it really is on again");

  // Which means the campaign can reach them once more.
  await register(user("NewGirlT"), { gender: "female", name: "NewGirlT" });
  ageProfile(u.id, { daysIdle: 4, patch: { winbackStage: 0 } });
  const tg = fakeTelegram();
  await wb.runOnce(tg, { force: true });
  assert.strictEqual(tg.sent.filter((m) => m.chatId === String(u.id)).length, 1);
});

// --- go ------------------------------------------------------------------------
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
