// "N people liked you" is announced at milestones, never per like.
//
// The thing worth protecting is the person's attention. A message per like is
// how a bot gets muted, and once muted every later message -- including a
// match -- is lost too. So these cases are mostly about SILENCE: proving the
// bot says nothing below the first milestone, says something exactly once at
// each crossing, and does not repeat itself in between.
//
// The step is different by gender: women accumulate admirers far faster than
// men, so the same step of 3 meant a constant buzz for women and a long wait
// either way for men. Men keep the original step of 3; women's is stretched
// to 7 so a milestone still means something.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const floodGuard = require("../src/floodGuard");
const { __test } = require("../src/discover");
const { milestoneFor, milestoneStepFor, LIKE_MILESTONE_STEP, pendingNotifications } = __test;

// A woman's milestone needs 7 admirers instead of 3, and this file browses
// past every ALREADY-registered candidate to reach each new one by name --
// so the later tests here, on top of each other, send far more than 40
// updates per person within 10 seconds. Past that the flood guard drops
// updates SILENTLY (by design -- see floodGuard.js), which does not fail
// loudly; it just makes a "❤️" tap vanish and a milestone count come out
// wrong for a reason that has nothing to do with milestones. Sweeping with a
// future clock expires every window, exactly like the other test files that
// register or browse in bulk.
function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const M = () => h.mainBot();

let nextId = 990000;
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

// Browses until `target` is on screen, then likes. Candidates come out in a
// random order, so "like this specific person" has to look for them.
//
// The pool this scans grows with every earlier test in this file (each one
// registers more people), so a limit sized for the first test is too small
// by the last one -- oversized here rather than tuned per call. The flood
// guard is swept on every iteration for the same reason: a single admirer
// dislike-scanning through dozens of already-registered candidates is easily
// more than 40 updates in 10 seconds, and past that Telegram-side throttling
// would start dropping this very loop's own taps.
async function likeFrom(liker, targetName, limit = 200) {
  let sent = await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", liker));
  for (let i = 0; i < limit; i++) {
    const card = sent.find((c) => c.method === "sendPhoto");
    if (card && (card.payload.caption || "").includes(targetName)) {
      const before = h.calls.length;
      await h.send(M(), h.textUpdate("❤️", liker));
      // The notification is queued and paced, not sent inline. Waiting for
      // the queue itself is exact; a fixed delay would either be flaky or
      // slow, and an announcement that lands one millisecond late reads as
      // "the bot said nothing".
      await pendingNotifications();
      return h.calls.slice(before);
    }
    resetFloodGuard();
    sent = await h.send(M(), h.textUpdate("👎", liker));
  }
  throw new Error(`never reached ${targetName}`);
}

const noticesTo = (sent, u) =>
  sent.filter(
    (c) =>
      c.method === "sendMessage" &&
      String(c.payload.chat_id) === String(u.id) &&
      /layk bosdi/.test(c.payload.text || "")
  );

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- the ladder, on its own --------------------------------------------------
test("men are stepped every 3rd like, women every 7th", () => {
  assert.strictEqual(milestoneStepFor("male"), 3);
  assert.strictEqual(milestoneStepFor("female"), 7);
  // An unknown/missing gender must not silently pick the more generous step.
  assert.strictEqual(milestoneStepFor(undefined), 3);
  assert.strictEqual(milestoneStepFor("other"), 3);
  assert.deepStrictEqual(LIKE_MILESTONE_STEP, { male: 3, female: 7, default: 3 });
});

test("the men's ladder is every third like: 3, 6, 9, 12 ...", () => {
  for (const [count, want] of [
    [0, 0], [1, 0], [2, 0],
    [3, 3], [4, 3], [5, 3],
    [6, 6], [7, 6], [8, 6],
    [9, 9], [11, 9],
    [12, 12], [30, 30], [31, 30], [100, 99],
  ]) {
    assert.strictEqual(milestoneFor(count, "male"), want, `milestoneFor(${count}, male)`);
  }

  // Every step really is three apart, with no gaps and no repeats -- the
  // property the ladder exists for, checked rather than assumed from the
  // handful of cases above.
  const crossings = [];
  for (let n = 1; n <= 60; n++) {
    if (milestoneFor(n, "male") !== milestoneFor(n - 1, "male")) crossings.push(n);
  }
  assert.deepStrictEqual(
    crossings,
    Array.from({ length: 20 }, (_, i) => (i + 1) * 3),
    "a message is due at 3, 6, 9, ... and nowhere else"
  );
});

test("the women's ladder is every seventh like: 7, 14, 21 ...", () => {
  for (const [count, want] of [
    [0, 0], [1, 0], [6, 0],
    [7, 7], [8, 7], [13, 7],
    [14, 14], [20, 14],
    [21, 21], [50, 49],
  ]) {
    assert.strictEqual(milestoneFor(count, "female"), want, `milestoneFor(${count}, female)`);
  }

  const crossings = [];
  for (let n = 1; n <= 70; n++) {
    if (milestoneFor(n, "female") !== milestoneFor(n - 1, "female")) crossings.push(n);
  }
  assert.deepStrictEqual(
    crossings,
    Array.from({ length: 10 }, (_, i) => (i + 1) * 7),
    "a message is due at 7, 14, 21, ... and nowhere else"
  );
});

// --- silence below the first milestone ---------------------------------------
test("a man hears nothing at one and two likes", async () => {
  const him = user("QuietMan");
  await register(him, { gender: "male", name: "QuietMan" });

  for (let i = 1; i <= 2; i++) {
    const her = user(`AdmirerF${i}`);
    await register(her, { gender: "female", name: `AdmirerF${i}` });
    const sent = await likeFrom(her, "QuietMan");
    assert.strictEqual(noticesTo(sent, him).length, 0, `like ${i} must be silent`);
  }
  assert.strictEqual(await db.getLikeNoticeAt(him.id), 0, "nothing announced yet");
});

test("a woman hears nothing through six likes", async () => {
  const her = user("QuietWoman");
  await register(her, { gender: "female", name: "QuietWoman" });

  for (let i = 1; i <= 6; i++) {
    const him = user(`AdmirerM${i}`);
    await register(him, { gender: "male", name: `AdmirerM${i}` });
    const sent = await likeFrom(him, "QuietWoman");
    assert.strictEqual(noticesTo(sent, her).length, 0, `like ${i} must be silent for a woman`);
  }
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 0, "nothing announced yet");
});

// --- the first milestone, per gender -----------------------------------------
test("a man: the third like announces once, the fourth stays quiet", async () => {
  const him = user("ThreeMan");
  await register(him, { gender: "male", name: "ThreeMan" });

  const admirers = [];
  for (let i = 1; i <= 4; i++) {
    const her = user(`FanF${i}`);
    await register(her, { gender: "female", name: `FanF${i}` });
    admirers.push(her);
  }

  await likeFrom(admirers[0], "ThreeMan");
  await likeFrom(admirers[1], "ThreeMan");

  const third = await likeFrom(admirers[2], "ThreeMan");
  const notices = noticesTo(third, him);
  assert.strictEqual(notices.length, 1, "the third like is the news");
  assert.match(notices[0].payload.text, /3 ta odam layk bosdi/, "it must name the real number");

  // And the button under it opens the likes list.
  const buttons = (notices[0].payload.reply_markup?.inline_keyboard || []).flat();
  assert.strictEqual(buttons.length, 1);
  assert.strictEqual(buttons[0].callback_data, "likes:show");
  assert.strictEqual(await db.getLikeNoticeAt(him.id), 3);

  const fourth = await likeFrom(admirers[3], "ThreeMan");
  assert.strictEqual(noticesTo(fourth, him).length, 0, "four is not a milestone for a man");
  assert.strictEqual(await db.getLikeNoticeAt(him.id), 3, "the marker does not move");
});

test("a woman: the seventh like announces once, the eighth stays quiet", async () => {
  const her = user("SevenWoman");
  await register(her, { gender: "female", name: "SevenWoman" });

  const admirers = [];
  for (let i = 1; i <= 8; i++) {
    const him = user(`FanM${i}`);
    await register(him, { gender: "male", name: `FanM${i}` });
    admirers.push(him);
  }

  for (let i = 0; i < 6; i++) await likeFrom(admirers[i], "SevenWoman");

  const seventh = await likeFrom(admirers[6], "SevenWoman");
  const notices = noticesTo(seventh, her);
  assert.strictEqual(notices.length, 1, "the seventh like is the news");
  assert.match(notices[0].payload.text, /7 ta odam layk bosdi/, "it must name the real number");
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 7);

  const eighth = await likeFrom(admirers[7], "SevenWoman");
  assert.strictEqual(noticesTo(eighth, her).length, 0, "eight is not a milestone for a woman");
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 7, "the marker does not move");
});

// --- the button really works -------------------------------------------------
test("the button under the notice opens the likes list", async () => {
  const him = user("Opener");
  await register(him, { gender: "male", name: "Opener" });
  for (let i = 1; i <= 3; i++) {
    const her = user(`OpF${i}`);
    await register(her, { gender: "female", name: `OpF${i}` });
    await likeFrom(her, "Opener");
  }

  const opened = await h.send(M(), h.callbackUpdate("likes:show", him));
  const text = opened
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");
  assert.match(text, /Sizni 3 kishi layk bosdi/, "the list must open with the same number");
  assert.ok(opened.some((c) => c.method === "sendPhoto"), "and show the people");
});

// --- the ladder, through the real bot ----------------------------------------
//
// Nine likes on a man, arriving one at a time, must produce exactly three
// messages -- at 3, at 6 and at 9 -- and silence on the six likes in between.
// Driven through the bot rather than the pure function because the marker
// that keeps 4 and 5 quiet is stored, and a bug there would not show up above.
test("nine likes on a man announce exactly three times: at 3, at 6 and at 9", async () => {
  const him = user("NineMan");
  await register(him, { gender: "male", name: "NineMan" });

  const announcedAt = [];
  for (let i = 1; i <= 9; i++) {
    const her = user(`NineF${i}`);
    await register(her, { gender: "female", name: `NineF${i}` });
    const sent = await likeFrom(her, "NineMan");
    const notices = noticesTo(sent, him);
    assert.ok(notices.length <= 1, `like ${i} must never produce two messages`);
    if (notices.length === 1) {
      announcedAt.push(i);
      assert.match(
        notices[0].payload.text,
        new RegExp(`${i} ta odam layk bosdi`),
        `the message at ${i} must name the real number`
      );
    }
  }

  assert.deepStrictEqual(announcedAt, [3, 6, 9], "every third like, nothing in between");
  assert.strictEqual(await db.getLikeNoticeAt(him.id), 9);
});

// Fourteen likes on a woman must announce exactly twice -- at 7 and at 14.
test("fourteen likes on a woman announce exactly twice: at 7 and at 14", async () => {
  const her = user("FourteenWoman");
  await register(her, { gender: "female", name: "FourteenWoman" });

  const announcedAt = [];
  for (let i = 1; i <= 14; i++) {
    const him = user(`FourteenM${i}`);
    await register(him, { gender: "male", name: `FourteenM${i}` });
    const sent = await likeFrom(him, "FourteenWoman");
    const notices = noticesTo(sent, her);
    assert.ok(notices.length <= 1, `like ${i} must never produce two messages`);
    if (notices.length === 1) {
      announcedAt.push(i);
      assert.match(
        notices[0].payload.text,
        new RegExp(`${i} ta odam layk bosdi`),
        `the message at ${i} must name the real number`
      );
    }
  }

  assert.deepStrictEqual(announcedAt, [7, 14], "every seventh like, nothing in between");
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 14);
});

// --- working through the backlog re-arms the milestone ------------------------
// Without this the marker only ever goes up, so somebody told once would
// never be told anything again for the rest of their time on the bot.
test("responding to likes lets the same milestone fire again later", async () => {
  const him = user("CycleMan");
  await register(him, { gender: "male", name: "CycleMan" });

  const first = [];
  for (let i = 1; i <= 3; i++) {
    const her = user(`CyF${i}`);
    await register(her, { gender: "female", name: `CyF${i}` });
    await likeFrom(her, "CycleMan");
    first.push(her);
  }
  assert.strictEqual(await db.getLikeNoticeAt(him.id), 3, "announced at three");

  // He works through them by answering each one. pendingLikerCount counts
  // the likers still waiting on him, so a like back clears them.
  for (const her of first) {
    await h.send(M(), h.callbackUpdate(`likeback:like:${her.id}`, him));
  }
  await pendingNotifications();

  // Three NEW people like him. The marker has to have come back down for this
  // to be announced again.
  let announcements = 0;
  for (let i = 1; i <= 3; i++) {
    const her = user(`CzF${i}`);
    await register(her, { gender: "female", name: `CzF${i}` });
    const sent = await likeFrom(her, "CycleMan");
    announcements += noticesTo(sent, him).length;
  }
  assert.strictEqual(announcements, 1, "the fresh batch is announced once more");
});

// --- go ----------------------------------------------------------------------
(async () => {
  await wait(1000);
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
