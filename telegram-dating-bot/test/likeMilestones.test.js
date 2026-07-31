// "N people liked you" is announced at milestones, never per like.
//
// The thing worth protecting is the person's attention. A message per like is
// how a bot gets muted, and once muted every later message -- including a
// match -- is lost too. So these cases are mostly about SILENCE: proving the
// bot says nothing at 1 and 2, says something exactly once at 3, and does not
// repeat itself at 4.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { __test } = require("../src/discover");
const { milestoneFor, LIKE_MILESTONES, LIKE_MILESTONE_STEP, pendingNotifications } = __test;

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
async function likeFrom(liker, targetName, limit = 30) {
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
test("the milestone ladder is 3, 5, 10, then every ten", () => {
  assert.deepStrictEqual(LIKE_MILESTONES, [3, 5, 10]);
  assert.strictEqual(LIKE_MILESTONE_STEP, 10);

  for (const [count, want] of [
    [0, 0], [1, 0], [2, 0],
    [3, 3], [4, 3],
    [5, 5], [6, 5], [9, 5],
    [10, 10], [11, 10], [19, 10],
    [20, 20], [29, 20],
    [30, 30], [99, 90], [100, 100], [137, 130],
  ]) {
    assert.strictEqual(milestoneFor(count), want, `milestoneFor(${count})`);
  }
});

// --- silence below the first milestone ---------------------------------------
test("one like and two likes say nothing at all", async () => {
  const her = user("Quiet");
  await register(her, { gender: "female", name: "Quiet" });

  for (let i = 1; i <= 2; i++) {
    const him = user(`Admirer${i}`);
    await register(him, { gender: "male", name: `Admirer${i}` });
    const sent = await likeFrom(him, "Quiet");
    assert.strictEqual(noticesTo(sent, her).length, 0, `like ${i} must be silent`);
  }
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 0, "nothing announced yet");
});

// --- the first milestone -----------------------------------------------------
test("the third like announces once, the fourth stays quiet", async () => {
  const her = user("Three");
  await register(her, { gender: "female", name: "Three" });

  const admirers = [];
  for (let i = 1; i <= 4; i++) {
    const him = user(`Fan${i}`);
    await register(him, { gender: "male", name: `Fan${i}` });
    admirers.push(him);
  }

  await likeFrom(admirers[0], "Three");
  await likeFrom(admirers[1], "Three");

  const third = await likeFrom(admirers[2], "Three");
  const notices = noticesTo(third, her);
  assert.strictEqual(notices.length, 1, "the third like is the news");
  assert.match(notices[0].payload.text, /3 ta odam layk bosdi/, "it must name the real number");

  // And the button under it opens the likes list.
  const buttons = (notices[0].payload.reply_markup?.inline_keyboard || []).flat();
  assert.strictEqual(buttons.length, 1);
  assert.strictEqual(buttons[0].callback_data, "likes:show");
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 3);

  const fourth = await likeFrom(admirers[3], "Three");
  assert.strictEqual(noticesTo(fourth, her).length, 0, "four is not a milestone");
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 3, "the marker does not move");
});

// --- the button really works -------------------------------------------------
test("the button under the notice opens the likes list", async () => {
  const her = user("Opener");
  await register(her, { gender: "female", name: "Opener" });
  for (let i = 1; i <= 3; i++) {
    const him = user(`Op${i}`);
    await register(him, { gender: "male", name: `Op${i}` });
    await likeFrom(him, "Opener");
  }

  const opened = await h.send(M(), h.callbackUpdate("likes:show", her));
  const text = opened
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");
  assert.match(text, /Sizni 3 kishi layk bosdi/, "the list must open with the same number");
  assert.ok(opened.some((c) => c.method === "sendPhoto"), "and show the people");
});

// --- the second milestone ----------------------------------------------------
test("the fifth like announces again", async () => {
  const her = user("Five");
  await register(her, { gender: "female", name: "Five" });

  let announcements = 0;
  for (let i = 1; i <= 5; i++) {
    const him = user(`Five${i}`);
    await register(him, { gender: "male", name: `Five${i}` });
    const sent = await likeFrom(him, "Five");
    announcements += noticesTo(sent, her).length;
  }
  assert.strictEqual(announcements, 2, "exactly two: one at three, one at five");
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 5);
});

// --- working through the backlog re-arms the milestone ------------------------
// Without this the marker only ever goes up, so somebody told once at three
// would never be told anything again for the rest of their time on the bot.
test("responding to likes lets the same milestone fire again later", async () => {
  const her = user("Cycle");
  await register(her, { gender: "female", name: "Cycle" });

  const first = [];
  for (let i = 1; i <= 3; i++) {
    const him = user(`Cy${i}`);
    await register(him, { gender: "male", name: `Cy${i}` });
    await likeFrom(him, "Cycle");
    first.push(him);
  }
  assert.strictEqual(await db.getLikeNoticeAt(her.id), 3, "announced at three");

  // She works through them by answering each one. pendingLikerCount counts
  // the likers still waiting on her, so a like back clears them.
  for (const him of first) {
    await h.send(M(), h.callbackUpdate(`likeback:like:${him.id}`, her));
  }
  await pendingNotifications();

  // Three NEW people like her. The marker has to have come back down for this
  // to be announced again.
  let announcements = 0;
  for (let i = 1; i <= 3; i++) {
    const him = user(`Cz${i}`);
    await register(him, { gender: "male", name: `Cz${i}` });
    const sent = await likeFrom(him, "Cycle");
    announcements += noticesTo(sent, her).length;
  }
  assert.strictEqual(announcements, 1, "the fresh batch is announced once more");
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
