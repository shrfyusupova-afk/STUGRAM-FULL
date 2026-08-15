// The referral leaderboard, and the invite count on a user's card.
//
// Both answer the same question -- who is actually bringing people in -- and
// both matter because the referral reward pays out real money: three finished
// invites buy a 9 900 so'm profile unlock. So the numbers have to be the ones
// the reward logic itself uses, or the board becomes a place where somebody
// farming credits looks ordinary.
//
// The distinction the whole file turns on: a CLICK on the link is not a
// user. Only a finished anketa counts, on the board and on the card -- so
// somebody who sent a link to a hundred people who all walked away ranks
// below somebody who brought in ten who stayed, and appears nowhere at all
// if none of them finished.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const { __test } = require("../src/adminBot");
const { formatReferralBoard, REFERRAL_TOP_N } = __test;

const M = () => h.mainBot();
const A = () => h.adminBot();

let nextId = 910000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

async function register(u, { gender = "male", name = "T", referrerId = null } = {}) {
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

// Clicks the link, starts the form, walks away. Recorded as a referral, but
// never rewarded -- the case the two numbers exist to tell apart.
async function abandonHalfway(referrerId, name) {
  const u = user(name);
  await h.send(M(), h.commandUpdate(`/start ref_${referrerId}`, u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate(name, u));
  return u;
}

const ADMIN_PIN = "13579";
async function loginAdmin(admin) {
  await h.send(A(), h.commandUpdate("/iamadmin", admin));
  for (const d of ADMIN_PIN) await h.send(A(), h.callbackUpdate(`admin:pin:${d}`, admin));
}

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

const BOARD_LABEL = "🏆 Takliflar statistikasi";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists and is logged in", async () => {
  admin = user("Boss");
  await register(admin, { gender: "male", name: "Boss" });
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));
});

// --- the empty case ----------------------------------------------------------

// The very first thing an admin sees after this ships is an empty board. It
// has to say so plainly rather than render a headed table with nothing under
// it, which reads as broken.
test("with nobody registered yet the board says so instead of showing an empty table", () => {
  const text = formatReferralBoard([]);
  assert.match(text, /Hozircha hech kim/, "an empty board must explain itself");
  assert.ok(!/🥇/.test(text), "and must not draw a podium with nothing on it");
});

// --- ordering ----------------------------------------------------------------

// The one property the board exists for: most first. Built from raw rows
// rather than the live database so a tie and a wide spread can both be
// checked without staging thirty registrations.
test("the board is ordered most-invites-first and marks the podium", () => {
  const rows = [
    { referrerId: "1", name: "<b>Alpha</b>", rewarded: 12 },
    { referrerId: "2", name: "<b>Beta</b>", rewarded: 7 },
    { referrerId: "3", name: "<b>Gamma</b>", rewarded: 3 },
    { referrerId: "4", name: "<b>Delta</b>", rewarded: 1 },
  ];
  const text = formatReferralBoard(rows);

  const positions = rows.map((r) => text.indexOf(r.name));
  assert.ok(
    positions.every((p, i) => i === 0 || p > positions[i - 1]),
    "the names must appear in the order given, highest first"
  );
  assert.ok(text.indexOf("🥇") < text.indexOf("🥈"), "gold before silver");
  assert.ok(text.indexOf("🥈") < text.indexOf("🥉"), "silver before bronze");
  assert.match(text, /4\./, "and past the podium, plain numbering");

  // The totals line has to add up, or it is worse than not being there.
  assert.match(text, /jami <b>23<\/b> ta/, "12+7+3+1");
});

// The number on the board is the one that means something. Somebody with 30
// clicks and 2 finished anketas has brought in two people, and showing 30
// anywhere on this screen would rank them like somebody who brought thirty.
test("the board shows the registered count and nothing else", () => {
  const text = formatReferralBoard([{ referrerId: "9", name: "<b>Funnel</b>", rewarded: 2 }]);
  assert.match(text, /<b>2<\/b> ta/, "the number is the people who actually registered");
  assert.ok(!/30/.test(text), "the click count must not appear at all");
  assert.ok(!/tugatmagan/.test(text), "and neither must the shortfall");
});

// Somebody can bring in a crowd without ever finishing their own anketa. The
// board must still name them rather than crashing on a missing profile.
test("a referrer with no anketa of their own still appears", () => {
  const text = formatReferralBoard([{ referrerId: "77", name: "<i>(anketasiz)</i>", rewarded: 4 }]);
  assert.match(text, /anketasiz/, "they are labelled, not dropped");
  assert.match(text, /<code>77<\/code>/, "and their id is there so the admin can search it");
});

// --- against the real database -----------------------------------------------

test("the board counts only invitees who finished, in the right order", async () => {
  // Two referrers, deliberately uneven: the busier one also has an invitee
  // who abandoned the form, and that one must not be counted anywhere.
  const busy = user("Busy");
  const quiet = user("Quiet");
  await register(busy, { gender: "male", name: "Busy" });
  await register(quiet, { gender: "male", name: "Quiet" });

  for (let i = 1; i <= 3; i++) {
    await register(user(`BF${i}`), { gender: "female", name: `BF${i}`, referrerId: busy.id });
  }
  await abandonHalfway(busy.id, "BFGone");
  await register(user("QF1"), { gender: "female", name: "QF1", referrerId: quiet.id });

  const top = await db.topReferrers(REFERRAL_TOP_N);
  const byId = new Map(top.map((r) => [String(r.referrerId), r]));

  assert.strictEqual(byId.get(String(busy.id))?.rewarded, 3, "the abandoned one does not count");
  assert.strictEqual(byId.get(String(quiet.id))?.rewarded, 1);

  const rank = top.map((r) => String(r.referrerId));
  assert.ok(
    rank.indexOf(String(busy.id)) < rank.indexOf(String(quiet.id)),
    "the busier referrer must come first"
  );

  // And the panel actually renders it when the button is pressed.
  const shown = await h.send(A(), h.textUpdate(BOARD_LABEL, admin));
  const text = said(shown);
  assert.match(text, /Takliflar statistikasi/, "the board should open");
  assert.match(text, /Busy/, "and name the top referrer");
  assert.ok(text.indexOf("Busy") < text.indexOf("Quiet"), "in the right order");
});

// Somebody who sends their link to a crowd that all walk away has brought in
// nobody. Ranking them by clicks would put them above people who actually
// grew the bot, so they are not on the board at all.
test("a referrer whose invitees all abandoned the form does not appear", async () => {
  const noisy = user("Noisy");
  await register(noisy, { gender: "male", name: "Noisy" });
  for (let i = 1; i <= 5; i++) await abandonHalfway(noisy.id, `NF${i}`);

  // The clicks were recorded -- this is not "the referral was lost".
  assert.strictEqual(await db.countReferrals(noisy.id), 5, "five people did open the link");
  assert.strictEqual(await db.countReferrals(noisy.id, { rewardedOnly: true }), 0, "and none finished");

  const top = await db.topReferrers(REFERRAL_TOP_N);
  assert.ok(
    !top.some((r) => String(r.referrerId) === String(noisy.id)),
    "five clicks and no registrations is not a place on the board"
  );

  // And their card says so plainly rather than showing five.
  const card = await h.send(A(), h.textUpdate(`/u_${noisy.id}`, admin));
  assert.match(said(card), /Taklif qilgan: yo'q/, "the card counts registrations too");
});

// "Why is browsing showing me men?" is answered by one stored field, and the
// card used to print the display LABEL instead of it. Those are two separate
// fields, and the case worth catching is exactly the one where they disagree.
test("a user card says what browsing will actually show them", async () => {
  const man = user("Manly");
  const woman = user("Womanly");
  await register(man, { gender: "male", name: "Manly" });
  await register(woman, { gender: "female", name: "Womanly" });

  const hisCard = said(await h.send(A(), h.textUpdate(`/u_${man.id}`, admin)));
  assert.match(hisCard, /<code>male<\/code>/, "the raw stored value, not only the label");
  assert.match(hisCard, /tanishuvlarda <b>ayollar<\/b>/, "and what it means for him");

  const herCard = said(await h.send(A(), h.textUpdate(`/u_${woman.id}`, admin)));
  assert.match(herCard, /<code>female<\/code>/);
  assert.match(herCard, /tanishuvlarda <b>erkaklar<\/b>/);
});

// The board is a list of who is worth talking to, so it must be capped --
// otherwise a successful bot answers with a message Telegram refuses to send.
test("the board never grows past the top ten", async () => {
  const top = await db.topReferrers(REFERRAL_TOP_N);
  assert.ok(top.length <= REFERRAL_TOP_N, `got ${top.length} rows, expected at most ${REFERRAL_TOP_N}`);
  assert.strictEqual(REFERRAL_TOP_N, 10);
});

// Only admins. The board carries user ids and behaviour patterns; it is not a
// screen a logged-out person may open by typing its label.
test("a non-admin cannot open the board", async () => {
  const outsider = user("Outsider");
  await register(outsider, { gender: "male", name: "Outsider" });
  const sent = await h.send(A(), h.textUpdate(BOARD_LABEL, outsider));
  assert.ok(!/🥇|Takliflar statistikasi — TOP/.test(said(sent)), "the board must not open for a stranger");
});

// --- the count on a user's card ----------------------------------------------

test("opening someone's card shows how many people they invited", async () => {
  const inviter = user("Inviter");
  await register(inviter, { gender: "male", name: "Inviter" });
  for (let i = 1; i <= 2; i++) {
    await register(user(`IF${i}`), { gender: "female", name: `IF${i}`, referrerId: inviter.id });
  }
  await abandonHalfway(inviter.id, "IFGone");

  const card = await h.send(A(), h.textUpdate(`/u_${inviter.id}`, admin));
  const text = said(card);
  assert.match(text, /Taklif qilgan: <b>2<\/b> ta/, "only the two who finished registering");
  assert.ok(!/<b>3<\/b> ta/.test(text), "the one who abandoned the form must not be counted");
});

test("someone who has invited nobody says so, rather than showing nothing", async () => {
  const loner = user("Loner");
  await register(loner, { gender: "male", name: "Loner" });

  const card = await h.send(A(), h.textUpdate(`/u_${loner.id}`, admin));
  assert.match(said(card), /Taklif qilgan: yo'q/, "an explicit zero, not a missing line");
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
