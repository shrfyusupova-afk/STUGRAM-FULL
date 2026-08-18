// The admin "💰 Sotuvlar" screen: a running total across every product, and
// three buttons that scope the exact same report to a rolling window --
// last 7 days, last 30, last 365 -- so "is this a good week" no longer means
// mentally subtracting last month's numbers from the all-time total.
//
// The windows are ROLLING from right now, not calendar week/month/year --
// the same convention the win-back sweeper and the AI snapshot already use
// elsewhere in this file. A calendar week resetting to near-zero every
// Monday morning would be a worse answer to "how are sales doing" than a
// rolling one, so that choice gets its own test below rather than being
// assumed.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const {
  PREMIUM_PRICE_SOM,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
} = require("../src/orders");

const A = () => h.adminBot();
const TX_PATH = path.join(DATA_DIR, "clickTransactions.json");

let nextId = 991000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

// Writes a single paid order straight into the ledger, backdated to
// `daysAgo`. Driving four real purchases through Click's Prepare/Complete
// callbacks just to control their paidAt timestamps would test the payment
// flow a second time rather than the report -- this writes exactly the
// fields orders.js itself would have written, at the point in the past the
// report needs to see.
let seq = 0;
function seedPaidOrder(type, amount, daysAgo) {
  seq += 1;
  const id = `${type}_seed${String(seq).padStart(20, "0")}`;
  const paidAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const all = fs.existsSync(TX_PATH) ? JSON.parse(fs.readFileSync(TX_PATH, "utf8")) : {};
  all[id] = {
    userId: "1",
    type,
    amount,
    status: "paid",
    provider: "click",
    createdAt: paidAt,
    paidAt,
  };
  fs.writeFileSync(TX_PATH, JSON.stringify(all, null, 2));
  return id;
}

const SALES = "💰 Sotuvlar";
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

// The three period buttons under the report, in whatever order they appear.
const periodCallbacks = (sent) =>
  sent.flatMap((c) => (c.payload.reply_markup?.inline_keyboard || []).flat()).map((b) => b.callback_data);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let admin;

test("setup: an admin exists, logged in, and four paid orders at different ages", async () => {
  admin = user("SalesBoss");
  await h.send(h.mainBot(), h.commandUpdate("/start", admin));
  await h.send(h.mainBot(), h.callbackUpdate("lang:uz", admin));
  await h.send(h.mainBot(), h.textUpdate("SalesBoss", admin));
  await h.send(h.mainBot(), h.textUpdate("30", admin));
  await h.send(h.mainBot(), h.callbackUpdate("gender:male", admin));
  await h.send(h.mainBot(), h.photoUpdate(admin));
  await h.send(h.mainBot(), h.textUpdate("Toshkent", admin));
  await h.send(h.mainBot(), h.textUpdate("Salom", admin));
  await h.send(h.mainBot(), h.contactUpdate(`+9989${admin.id}`, admin));
  await h.send(h.mainBot(), h.textUpdate("✅ Ha", admin));
  await db.addAdmin(admin.id);
  await loginAdmin(admin);
  assert.ok(await db.isAdmin(admin.id));

  // 2 days ago: inside the week, the month, and the year.
  seedPaidOrder("anongender", ANON_GENDER_PRICE_SOM, 2);
  // 10 days ago: outside the week, inside the month and the year.
  seedPaidOrder("vipchat", VIP_CHAT_PRICE_SOM, 10);
  // 60 days ago: outside the week and the month, inside the year.
  seedPaidOrder("unlock", UNLOCK_PRICE_SOM, 60);
  // 400 days ago: outside all three rolling windows, but still all-time.
  seedPaidOrder("premium", PREMIUM_PRICE_SOM, 400);
});

// --- the main screen -----------------------------------------------------

test("the main screen counts all four orders and shows their total", async () => {
  const sent = await h.send(A(), h.textUpdate(SALES, admin));
  const text = said(sent);
  assert.match(text, /barcha vaqt/i, "must be labelled as the all-time report");
  assert.match(text, /Umumiy sotuv: 4 ta/, "all four orders must be counted");

  const totalRevenue = ANON_GENDER_PRICE_SOM + VIP_CHAT_PRICE_SOM + UNLOCK_PRICE_SOM + PREMIUM_PRICE_SOM;
  assert.ok(text.includes(totalRevenue.toLocaleString("uz-UZ")), "the total revenue must be the sum of all four");
});

test("three period buttons are offered under the main screen", async () => {
  const sent = await h.send(A(), h.textUpdate(SALES, admin));
  const callbacks = periodCallbacks(sent);
  assert.deepStrictEqual(
    callbacks.sort(),
    ["admin:sales:month", "admin:sales:week", "admin:sales:year"].sort()
  );
});

// --- each window sees only what belongs in it -----------------------------

test("the weekly button counts only the 2-day-old order", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:sales:week", admin));
  const text = said(sent);
  assert.match(text, /Umumiy sotuv: 1 ta/, `expected exactly one order in the week: ${text}`);
  assert.ok(text.includes(ANON_GENDER_PRICE_SOM.toLocaleString("uz-UZ")));
});

test("the monthly button counts the 2-day and 10-day orders, not the 60-day one", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:sales:month", admin));
  const text = said(sent);
  assert.match(text, /Umumiy sotuv: 2 ta/, `expected exactly two orders in the month: ${text}`);
  const monthRevenue = ANON_GENDER_PRICE_SOM + VIP_CHAT_PRICE_SOM;
  assert.ok(text.includes(monthRevenue.toLocaleString("uz-UZ")));
});

test("the yearly button counts three orders, excluding only the 400-day-old one", async () => {
  const sent = await h.send(A(), h.callbackUpdate("admin:sales:year", admin));
  const text = said(sent);
  assert.match(text, /Umumiy sotuv: 3 ta/, `expected exactly three orders in the year: ${text}`);
  const yearRevenue = ANON_GENDER_PRICE_SOM + VIP_CHAT_PRICE_SOM + UNLOCK_PRICE_SOM;
  assert.ok(text.includes(yearRevenue.toLocaleString("uz-UZ")));
});

// --- the windows really are rolling, not calendar-aligned -----------------

test("the report is a rolling window from now, not a calendar period", async () => {
  // An order from exactly 8 days ago must be outside "weekly" (7 days) --
  // if the window were calendar-aligned to Monday, this could go either way
  // depending on what day the suite happens to run.
  seedPaidOrder("anongender", ANON_GENDER_PRICE_SOM, 8);
  const sent = await h.send(A(), h.callbackUpdate("admin:sales:week", admin));
  const text = said(sent);
  assert.match(text, /Umumiy sotuv: 1 ta/, "an 8-day-old order must still fall outside a 7-day window");
});

// --- who may see it --------------------------------------------------------

test("a non-admin gets nothing from the label or the buttons", async () => {
  const outsider = user("Nosy");
  await h.send(h.mainBot(), h.commandUpdate("/start", outsider));
  await h.send(h.mainBot(), h.callbackUpdate("lang:uz", outsider));
  await h.send(h.mainBot(), h.textUpdate("Nosy", outsider));
  await h.send(h.mainBot(), h.textUpdate("25", outsider));
  await h.send(h.mainBot(), h.callbackUpdate("gender:female", outsider));
  await h.send(h.mainBot(), h.photoUpdate(outsider));
  await h.send(h.mainBot(), h.textUpdate("Toshkent", outsider));
  await h.send(h.mainBot(), h.textUpdate("Salom", outsider));
  await h.send(h.mainBot(), h.contactUpdate(`+9989${outsider.id}`, outsider));
  await h.send(h.mainBot(), h.textUpdate("✅ Ha", outsider));

  const menu = await h.send(A(), h.textUpdate(SALES, outsider));
  assert.ok(!/Sotuvlar hisoboti/.test(said(menu)), "the report must not open");

  const period = await h.send(A(), h.callbackUpdate("admin:sales:week", outsider));
  assert.ok(!/Sotuvlar hisoboti/.test(said(period)), "and a period button must not work either");
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
