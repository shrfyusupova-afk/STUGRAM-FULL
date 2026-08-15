// "Kimlar yoqtirdi" is a queue you work through, not a pile dumped on you.
//
// It used to loop over every liker and fire a card per person in one go, so
// opening it with a dozen admirers threw a dozen photos into the chat at
// once -- and the ❤️/👎 you were meant to press for each was buried
// somewhere up the scrollback. And 👎 only deleted the message off the
// screen without recording anything, so the same person was back at the top
// of the list the very next time it was opened.
//
// The ❤️/👎 now live on the keyboard under the chat, exactly as they do while
// browsing -- so most of these drive plain text taps rather than callbacks,
// which is what a person actually sends.
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

// The keyboard under the chat, as rows of plain labels.
const keyboardRows = (sent, u) => {
  const withKeyboard = to(sent, u).filter((c) => c.payload.reply_markup?.keyboard);
  if (withKeyboard.length === 0) return null;
  const last = withKeyboard[withKeyboard.length - 1];
  return last.payload.reply_markup.keyboard.map((row) => row.map((b) => (typeof b === "string" ? b : b.text)));
};

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

// The point of the whole change: the controls for this screen are the ones
// under your thumb, and they are the SAME ones browsing uses. Before this the
// card carried inline ❤️/👎 while the keyboard underneath still offered the
// main menu, so the two rows of controls on screen disagreed about what this
// screen was for.
test("the likes list puts ❤️ 👎, report and back under the chat", async () => {
  const her = user("Keyed");
  await register(her, { gender: "female", name: "Keyed" });
  const him = user("Suitor");
  await register(him, { gender: "male", name: "Suitor" });
  await likes(him, her);

  const opened = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const rows = keyboardRows(opened, her);
  assert.ok(rows, "a keyboard must come with the card");
  assert.deepStrictEqual(rows[0], ["❤️", "👎"], "like and dislike, first row");
  assert.match(rows[1][0], /Shikoyat/i, "report on the second row");
  assert.match(rows[2][0], /Orqaga/i, "back on the third");

  // And no second set of the same controls stuck to the card itself.
  const inline = buttons(opened, her).map((b) => b.callback_data || "");
  assert.ok(
    !inline.some((d) => d.startsWith("likeback:")),
    `the card must not carry duplicate ❤️/👎 buttons, got ${JSON.stringify(inline)}`
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

  const answered = await h.send(M(), h.textUpdate("❤️", her));
  await __test.pendingNotifications();
  assert.strictEqual(await db.hasLiked(her.id, a.id), true, "the ❤️ answered the person on screen");
  assert.ok(
    cards(answered, her).some((c) => /SecondUp/.test(captionOf(c))),
    "answering hands over the next card without a second tap"
  );
});

// The ❤️ under the chat is the same label the browse screen uses. If the
// likes list did not get first refusal on it, this tap would have liked
// whoever was last on the browse screen instead -- somebody the person never
// chose.
test("❤️ answers the admirer on screen, not the last browsed candidate", async () => {
  const her = user("Crossed");
  await register(her, { gender: "female", name: "Crossed" });

  const browsed = user("Browsed");
  const admirer = user("Admires");
  await register(browsed, { gender: "male", name: "Browsed" });
  await register(admirer, { gender: "male", name: "Admires" });
  await likes(admirer, her);

  // She browses first, so a candidate is sitting in the browse state.
  await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", her));

  // Then opens her likes list and answers.
  await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  await h.send(M(), h.textUpdate("❤️", her));
  await __test.pendingNotifications();

  assert.strictEqual(await db.hasLiked(her.id, admirer.id), true, "the admirer is the one she answered");
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
  assert.match(captionOf(cards(opened, her)[0]), /NotForMe/, "the queue starts at the first liker");

  const passed = await h.send(M(), h.textUpdate("👎", her));
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

  await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const done = await h.send(M(), h.textUpdate("👎", her));

  const text = to(done, her).map((c) => c.payload.text || "").join("\n");
  assert.match(text, /hech kim|ko'rib chiqdingiz/, `the end of the queue must be stated: ${text}`);

  // With nobody left to decide about, ❤️/👎 would do nothing -- so the main
  // menu comes back rather than dead controls staying on screen.
  const rows = keyboardRows(done, her);
  assert.ok(rows && !rows.some((row) => row.includes("❤️")), `expected the main menu back, got ${JSON.stringify(rows)}`);
});

// The one way a same-gender card could reach a screen that looks exactly like
// browsing: somebody likes you, then edits their own profile and changes
// their gender. The like is still on record, and the likes list had no gender
// rule of its own -- it relied entirely on browsing never producing one.
test("somebody who changed gender after liking you drops out of the list", async () => {
  const her = user("Filtered");
  await register(her, { gender: "female", name: "Filtered" });

  const stays = user("StillMale");
  const switched = user("Switched");
  await register(stays, { gender: "male", name: "StillMale" });
  await register(switched, { gender: "male", name: "Switched" });
  await likes(stays, her);
  await likes(switched, her);

  // Both are in the list while both are men.
  const before = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  assert.match(
    to(before, her).map((c) => c.payload.text || "").join("\n"),
    /2 kishi/,
    "both admirers are waiting to begin with"
  );

  // One of them switches. Their like is untouched -- this is not about
  // deleting history, only about what a dating screen may show.
  const profile = await db.getProfile(switched.id);
  await db.saveProfile(switched.id, { ...profile, gender: "female", genderLabel: "Ayol" });
  assert.strictEqual(await db.hasLiked(switched.id, her.id), true, "the like itself is still recorded");

  // The list shows one card at a time, so the count in the intro is what
  // reveals the whole queue -- a card-only assertion would pass either way
  // simply because the other person happened to be second.
  const after = await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  const intro = to(after, her).map((c) => c.payload.text || "").join("\n");
  assert.match(intro, /1 kishi/, "only the one who is still a man is left waiting");

  // And walking the whole queue never turns her up.
  const seen = [captionOf(cards(after, her)[0])];
  for (let i = 0; i < 3; i++) {
    const next = await h.send(M(), h.textUpdate("👎", her));
    const card = cards(next, her)[0];
    if (!card) break;
    seen.push(captionOf(card));
  }
  const shown = seen.join("\n");
  assert.ok(!/Switched/.test(shown), `a woman must not appear in a woman's likes list: ${shown.slice(0, 200)}`);
  assert.match(shown, /StillMale/, "and the man who is still a man is still there");
});

// Leaving the likes list must put the ❤️ back where it belongs: on the browse
// screen. Otherwise the mode would outlive the screen and the next ❤️ would
// still be read as answering an admirer.
test("going back, then browsing, likes the candidate on screen", async () => {
  const her = user("Leaver");
  await register(her, { gender: "female", name: "Leaver" });

  const admirer = user("Waiting");
  const candidate = user("OnScreen");
  await register(admirer, { gender: "male", name: "Waiting" });
  await register(candidate, { gender: "male", name: "OnScreen" });
  await likes(admirer, her);

  await h.send(M(), h.textUpdate("💌 Kimlar yoqtirdi", her));
  await h.send(M(), h.textUpdate("⬅️ Orqaga", her));

  // Browsing again. Candidates come out in a random order, so who is on
  // screen is read from the browse state rather than assumed -- that field IS
  // "who is on screen", and the point here is that ❤️ follows it.
  await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", her));
  const onScreen = (await db.getDiscoverState(her.id))?.currentId;
  assert.ok(onScreen, "browsing should put somebody on screen");

  await h.send(M(), h.textUpdate("❤️", her));
  await __test.pendingNotifications();

  assert.strictEqual(
    await db.hasLiked(her.id, onScreen),
    true,
    "the ❤️ must land on whoever the browse screen showed"
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
