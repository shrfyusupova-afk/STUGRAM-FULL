// "Kimlar yoqtirdi" is a queue you work through, not a pile dumped on you.
//
// It used to loop over every liker and fire a card per person in one go, so
// opening it with a dozen admirers threw a dozen photos into the chat at
// once -- and the ❤️/👎 you were meant to press for each was buried
// somewhere up the scrollback. And 👎 only deleted the message off the
// screen without recording anything, so the same person was back at the top
// of the list the very next time it was opened.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { __test } = require("../src/discover");

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

const to = (sent, u) => sent.filter((c) => String(c.payload.chat_id) === String(u.id));
const cards = (sent, u) => to(sent, u).filter((c) => c.method === "sendPhoto");
const buttons = (sent, u) =>
  to(sent, u).flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat());
const captionOf = (call) => call.payload.caption || "";

// Records a like directly. The point of these tests is the LIST, not the
// swipe that fills it, so the likes go in through storage rather than
// through 30 swipes each.
async function likes(liker, target) {
  await db.recordLike(liker.id, target.id);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("opening the list shows exactly ONE card, not one per liker", async () => {
  const her = user("Popular");
  await register(her, { gender: "female", name: "Popular" });

  const admirers = [];
  for (const name of ["AdmirerA", "AdmirerB", "AdmirerC", "AdmirerD"]) {
    const u = user(name);
    await register(u, { gender: "male", name });
    await likes(u, her);
    admirers.push(u);
  }

  const opened = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  assert.strictEqual(
    cards(opened, her).length,
    1,
    `four people liked her; opening the list must send ONE card, sent ${cards(opened, her).length}`
  );
  // ...and it must say how many are waiting, so one card doesn't read as
  // "only one person liked me".
  assert.match(
    to(opened, her).map((c) => c.payload.text || "").join("\n"),
    /4 kishi/,
    "the intro states how many are waiting"
  );
});

test("liking back moves straight on to the next one", async () => {
  const her = user("Chooser");
  await register(her, { gender: "female", name: "Chooser" });

  const a = user("FirstUp");
  const b = user("SecondUp");
  await register(a, { gender: "male", name: "FirstUp" });
  await register(b, { gender: "male", name: "SecondUp" });
  await likes(a, her);
  await likes(b, her);

  const opened = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const firstCard = cards(opened, her)[0];
  assert.match(captionOf(firstCard), /FirstUp/, "the queue starts at the first liker");

  // The ❤️ under it carries the position, which is what lets one tap both
  // answer and advance.
  const like = buttons(opened, her).find((btn) => (btn.callback_data || "").startsWith("likeback:like:"));
  assert.ok(like, "the undecided card offers ❤️");
  assert.match(like.callback_data, /^likeback:like:\d+:0$/, "the ❤️ knows where it is in the queue");

  const answered = await h.send(M(), h.callbackUpdate(like.callback_data, her));
  await __test.pendingNotifications();
  assert.ok(
    cards(answered, her).some((c) => /SecondUp/.test(captionOf(c))),
    "answering hands over the next card without a second tap"
  );
});

test("turning someone down is remembered, so they do not come back", async () => {
  const her = user("Picky");
  await register(her, { gender: "female", name: "Picky" });

  const no = user("NotForMe");
  const yes = user("Maybe");
  await register(no, { gender: "male", name: "NotForMe" });
  await register(yes, { gender: "male", name: "Maybe" });
  await likes(no, her);
  await likes(yes, her);

  const opened = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const pass = buttons(opened, her).find((btn) => (btn.callback_data || "").startsWith("likeback:dislike:"));
  assert.ok(pass, "the undecided card offers 👎");

  const passed = await h.send(M(), h.callbackUpdate(pass.callback_data, her));
  // The turned-down person vacates their slot, so the next card must be the
  // OTHER admirer -- not a re-run of the one just refused, and not a skip
  // straight past somebody.
  assert.ok(
    cards(passed, her).some((c) => /Maybe/.test(captionOf(c))),
    "the next person in the queue follows immediately"
  );

  // Reopening is the real test: a 👎 that only cleared the screen left them
  // sitting at the top of the list again.
  const reopened = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const shown = cards(reopened, her).map(captionOf).join("\n");
  assert.ok(!/NotForMe/.test(shown), "a refused liker must not reappear on reopening");
  assert.match(shown, /Maybe/, "the one still waiting is what comes up");
});

test("working to the end says so, instead of showing nothing", async () => {
  const her = user("Finisher");
  await register(her, { gender: "female", name: "Finisher" });

  const only = user("OnlyOne");
  await register(only, { gender: "male", name: "OnlyOne" });
  await likes(only, her);

  const opened = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const pass = buttons(opened, her).find((btn) => (btn.callback_data || "").startsWith("likeback:dislike:"));
  const done = await h.send(M(), h.callbackUpdate(pass.callback_data, her));

  const text = to(done, her).map((c) => c.payload.text || "").join("\n");
  assert.match(text, /hech kim|ko'rib chiqdingiz/, `the end of the queue must be stated: ${text}`);
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
