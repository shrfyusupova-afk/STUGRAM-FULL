// "Who joined today", in the admin panel.
//
// Two things make this more than a count. It is TODAY in Tashkent, not in
// UTC -- the two disagree for five hours every night, which is exactly when
// somebody checking the panel late would be asking, and "0 joined today" at
// 1am because the server already rolled over is worse than no screen at all.
//
// And it reuses the search results list exactly -- ten per screen, the same
// back/forward buttons, every id rendered as a tappable /u_<id> that posts
// the full anketa underneath. Two admin screens doing the same job must not
// look like two different products.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const floodGuard = require("../src/floodGuard");
const { __test } = require("../src/adminBot");
const { startOfTashkentDay } = __test;

// This file registers a dozen people back to back -- far faster than a human,
// and past the flood guard's 40-per-10s ceiling, which drops updates in
// silence. Sweeping with a future clock expires every window.
function resetFloodGuard() {
  floodGuard.__test.sweep(Date.now() + floodGuard.__test.WINDOW_MS + 1);
}

const M = () => h.mainBot();
const A = () => h.adminBot();

let nextId = 890000;
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

const inline = (sent) =>
  sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat());
const cards = (sent) => sent.filter((c) => c.method === "sendPhoto" || c.method === "sendVideo");

const TODAY = "📅 Bugun qo'shilganlar";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists and is logged in", async () => {
  admin = user("DayBoss");
  await register(admin, { gender: "male", name: "DayBoss" });
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));
});

// --- the day boundary --------------------------------------------------------
//
// The one piece of logic here that is easy to get wrong and impossible to
// notice: the cutoff has to be Tashkent midnight expressed as an instant, not
// UTC midnight.
test("the day starts at Tashkent midnight, not UTC midnight", () => {
  // 00:30 Tashkent on the 18th is 19:30 UTC on the 17th. The day it belongs
  // to began at 19:00 UTC on the 17th -- NOT at 00:00 UTC on the 18th, which
  // is still 4.5 hours in the future at that moment.
  const lateNight = new Date("2026-08-17T19:30:00.000Z");
  assert.strictEqual(startOfTashkentDay(lateNight), "2026-08-17T19:00:00.000Z");

  // Midday is unambiguous, and must land on the same boundary.
  const midday = new Date("2026-08-18T07:00:00.000Z");
  assert.strictEqual(startOfTashkentDay(midday), "2026-08-17T19:00:00.000Z");

  // One second before Tashkent midnight belongs to the PREVIOUS day.
  const justBefore = new Date("2026-08-17T18:59:59.000Z");
  assert.strictEqual(startOfTashkentDay(justBefore), "2026-08-16T19:00:00.000Z");

  // And the boundary itself starts the new day.
  const exactly = new Date("2026-08-17T19:00:00.000Z");
  assert.strictEqual(startOfTashkentDay(exactly), "2026-08-17T19:00:00.000Z");
});

// --- the empty case ----------------------------------------------------------

// Runs before any woman has registered in this file, so it exercises the real
// empty branch rather than a stub. A headed pager with nothing under it reads
// as broken; it has to say plainly that there is nobody.
test("an empty list says so instead of showing a blank one", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:today:female", admin));
  assert.match(said(sent), /bo'sh|qo'shilmagan/, "it must say the list is empty");
  assert.strictEqual(cards(sent).length, 0, "and send no card");
});

// A button that disappears on a quiet day is indistinguishable from a button
// that broke. Both are always there, with the count on them -- so (0) says
// "nobody joined", and the screen keeps the same shape every day.
test("both buttons are shown even when one side is empty", async () => {
  const sent = await h.send(A(), h.textUpdate(TODAY, admin));
  const buttons = inline(sent);
  const data = buttons.map((b) => b.callback_data);

  assert.ok(data.includes("admin:today:male"), "the boys button");
  assert.ok(data.includes("admin:today:female"), "and the girls button, with nobody in it");

  const girls = buttons.find((b) => b.callback_data === "admin:today:female");
  assert.match(girls.text, /\(0\)/, "and it says zero rather than hiding");
});

// --- the summary and the two lists -------------------------------------------

test("the summary counts today's arrivals by gender", async () => {
  for (const name of ["Boy1", "Boy2", "Boy3"]) {
    await register(user(name), { gender: "male", name });
  }
  for (const name of ["Girl1", "Girl2"]) {
    await register(user(name), { gender: "female", name });
  }

  const sent = await h.send(A(), h.textUpdate(TODAY, admin));
  const text = said(sent);

  assert.match(text, /Bugun qo'shilganlar/, "the screen opens");
  // The admin registered in this same file and is male, so boys is 3 + 1.
  assert.match(text, /Bollar: 4 ta/, "boys are counted");
  assert.match(text, /Qizlar: 2 ta/, "and so are girls");
  assert.match(text, /Jami: <b>6<\/b> ta/, "and the total adds up");

  const buttons = inline(sent).map((b) => b.callback_data);
  assert.ok(buttons.includes("admin:today:male"), "a button into the boys list");
  assert.ok(buttons.includes("admin:today:female"), "and one into the girls list");
});

// A text list, not a pile of photos -- and every id a tappable command, so
// the anketa is one tap away without retyping anything.
test("the list names everyone, with a tappable id for each", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:today:female", admin));
  const text = said(sent);

  assert.strictEqual(cards(sent).length, 0, "a list, not one photo per person");
  assert.match(text, /Bugun qo'shilgan qizlar/, "it says which list this is");
  assert.match(text, /Girl1/, "and names them");
  assert.match(text, /Girl2/, "all of them, not one at a time");
  assert.match(text, /\/u_\d+/, "each id is a tappable command");
  assert.match(text, /🎂/, "with the birth year");
  assert.match(text, /📞/, "and the phone");
});

// The id in the list really opens the anketa -- the whole reason it is
// rendered as a command rather than plain text.
test("tapping an id in the list opens that person's anketa", async () => {
  const her = user("Openable");
  await register(her, { gender: "female", name: "Openable" });

  const list = await h.send(A(), h.callbackUpdate("admin:today:female", admin));
  const command = (said(list).match(new RegExp(`/u_${her.id}`)) || [])[0];
  assert.ok(command, `the new person should be listed: ${said(list).slice(0, 300)}`);

  const opened = await h.send(A(), h.textUpdate(command, admin));
  assert.strictEqual(cards(opened).length, 1, "the anketa opens as a card");
  assert.match(said(opened), /Openable/, "and it is the right person");
});

// Ten per screen, with the same back/forward buttons the search list uses.
test("more than ten people are paged, not truncated", async () => {
  for (let i = 1; i <= 12; i++) {
    await register(user(`Many${i}`), { gender: "male", name: `Many${i}` });
    if (i % 5 === 0) resetFloodGuard();
  }

  const sent = await h.send(A(), h.callbackUpdate("admin:today:male", admin));
  const text = said(sent);
  assert.match(text, /sahifa/, "the header says which page this is");

  const nav = inline(sent).map((b) => b.callback_data);
  assert.ok(nav.some((d) => /^admin:pg:1$/.test(d)), "and there is a next page to go to");

  // The count in the header must be the whole day, not just this screen.
  const declared = Number((text.match(/— (\d+) ta/) || [])[1]);
  assert.ok(declared >= 13, `the header should count everyone, got ${declared}`);
});

// The screen carries ids, phone numbers and photos. It is not something a
// logged-out person may open by typing its label.
test("a non-admin cannot open it, or page through it", async () => {
  const outsider = user("Nosy");
  await register(outsider, { gender: "male", name: "Nosy" });

  const menu = await h.send(A(), h.textUpdate(TODAY, outsider));
  assert.ok(!/Bugun qo'shilganlar/.test(said(menu)), "the summary must not open");

  const paged = await h.send(A(), h.callbackUpdate("admin:today:female", outsider));
  assert.ok(!/Bugun qo'shilgan/.test(said(paged)), "and the list may not be opened directly");
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
