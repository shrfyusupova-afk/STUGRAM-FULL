// "Who joined today", in the admin panel.
//
// Two things make this more than a count. It is TODAY in Tashkent, not in
// UTC -- the two disagree for five hours every night, which is exactly when
// somebody checking the panel late would be asking, and "0 joined today" at
// 1am because the server already rolled over is worse than no screen at all.
//
// And it is paged. A good day is dozens of profiles, and firing dozens of
// photos into the chat at once is the mistake the likes list already made
// once.
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
const { startOfTashkentDay, todayCard } = __test;

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
test("an empty list says so instead of showing a blank card", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:today:female:0", admin));
  assert.match(said(sent), /bo'sh|qo'shilmagan/, "it must say the list is empty");
  assert.strictEqual(cards(sent).length, 0, "and send no card");
});

// A profile with missing fields must still render -- an admin looking at a
// half-filled record is exactly when they most need to see it.
test("a card renders even when fields are missing", () => {
  const text = todayCard(0, 1, "12345", { name: "X", age: 20 });
  assert.match(text, /1\/1/);
  assert.match(text, /12345/);
  assert.match(text, /—/, "missing fields show a dash rather than 'undefined'");
  assert.ok(!/undefined/.test(text), `no raw undefined in the card: ${text}`);
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
  assert.ok(buttons.includes("admin:today:male:0"), "a button into the boys list");
  assert.ok(buttons.includes("admin:today:female:0"), "and one into the girls list");
});

// One card at a time, with the position on it -- the whole point of paging.
test("opening a list shows ONE person, numbered, with their details", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:today:female:0", admin));

  assert.strictEqual(cards(sent).length, 1, "exactly one card, not one per person");
  const text = said(sent);
  assert.match(text, /1\/2/, "numbered, so the admin knows where they are");
  assert.match(text, /Girl1/, "the name of the person at this position");
  // The point of paging: everybody ELSE stays off the screen. Without this,
  // quietly sending the whole list alongside the card would still pass.
  assert.ok(!/Girl2/.test(text), `only the current person may appear: ${text.slice(0, 200)}`);
  assert.match(text, /🆔/, "the id, so it can be pasted into the search");
  assert.match(text, /📞/, "and the phone");
});

test("the pager walks forward and back, and stops at both ends", async () => {
  const first = await h.send(A(), h.callbackUpdate("admin:today:female:0", admin));
  let nav = inline(first).map((b) => b.callback_data);
  assert.ok(nav.includes("admin:today:female:1"), "forward is offered on the first card");
  assert.ok(!nav.includes("admin:today:female:-1"), "and there is no way back past the start");

  const second = await h.send(A(), h.callbackUpdate("admin:today:female:1", admin));
  assert.match(said(second), /2\/2/, "the second card knows its position");
  nav = inline(second).map((b) => b.callback_data);
  assert.ok(nav.includes("admin:today:female:0"), "back is offered on the last card");
  assert.ok(!nav.includes("admin:today:female:2"), "and forward past the end is not");
});

// The list is re-read on every tap, so somebody registering mid-browse is
// picked up rather than being invisible behind a stale snapshot.
test("somebody registering mid-browse appears without reopening the screen", async () => {
  const before = await h.send(A(), h.callbackUpdate("admin:today:female:0", admin));
  assert.match(said(before), /1\/2/);

  await register(user("Girl3"), { gender: "female", name: "Girl3" });

  const after = await h.send(A(), h.callbackUpdate("admin:today:female:0", admin));
  assert.match(said(after), /1\/3/, "the total updates on the next tap");
});

// An index past the end can be reached from a button on an older message,
// after people have been deactivated or removed.
test("a stale position says the list ended instead of erroring", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:today:female:99", admin));
  assert.match(said(sent), /tugadi/, "it must say the list ran out");
  assert.strictEqual(cards(sent).length, 0, "and show nothing");
});

// The screen carries ids, phone numbers and photos. It is not something a
// logged-out person may open by typing its label.
test("a non-admin cannot open it, or page through it", async () => {
  const outsider = user("Nosy");
  await register(outsider, { gender: "male", name: "Nosy" });

  const menu = await h.send(A(), h.textUpdate(TODAY, outsider));
  assert.ok(!/Bugun qo'shilganlar/.test(said(menu)), "the summary must not open");

  const paged = await h.send(A(), h.callbackUpdate("admin:today:female:0", outsider));
  assert.strictEqual(cards(paged).length, 0, "and no card may be paged to directly");
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
