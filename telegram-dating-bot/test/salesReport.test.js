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
const { __test: adminTest } = require("../src/adminBot");
const db = require("../src/db");
const {
  PREMIUM_PRICE_SOM,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  getSalesSummary,
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
function seedPaidOrder(type, amount, daysAgo, extra = {}) {
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
    ...extra,
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

test("the main screen offers the three periods and the ad breakdown", async () => {
  const sent = await h.send(A(), h.textUpdate(SALES, admin));
  const callbacks = periodCallbacks(sent);
  assert.deepStrictEqual(
    callbacks.sort(),
    ["admin:sales:ads", "admin:sales:month", "admin:sales:week", "admin:sales:year"].sort()
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

// --- every product needs its own bucket ------------------------------------
//
// Premium is the DEFAULT bucket in getSalesSummary: it takes everything not
// claimed by a named type. So a new product that nobody adds to that list has
// its income silently reported as Premium revenue -- which is exactly what
// happened to the ForResult board. These two cases are what makes that
// mistake loud instead of invisible.

test("ad-board income is reported on its own, not folded into Premium", async () => {
  seedPaidOrder("adboard", 250000, 1);
  const sales = await getSalesSummary();

  assert.ok(sales.adboard, "the board needs a bucket of its own");
  assert.ok(sales.adboard.totalRevenue >= 250000, "and the money has to land in it");

  // The bug this replaces: an unnamed type falls through to Premium, so the
  // Premium line quietly reports advertising money as subscription money.
  const premiumRows = PREMIUM_PRICE_SOM * sales.premium.count;
  assert.strictEqual(
    sales.premium.totalRevenue,
    premiumRows,
    "Premium revenue must be a whole number of Premium subscriptions and nothing else"
  );
});

test("every product the report prints is also counted in its total", () => {
  const lines = adminTest.salesLines();
  const sales = {};
  // One so'm per product, so the total is simply "how many products exist" --
  // any line missing from the sum shows up as an off-by-one.
  for (const line of lines) sales[line.key] = { count: 1, totalRevenue: 1 };

  const text = adminTest.formatSalesReport(sales, "sinov");
  for (const line of lines) {
    assert.ok(text.includes(line.label), `"${line.label}" must appear in the report`);
  }
  assert.match(text, new RegExp(`Umumiy sotuv: ${lines.length} ta`), "the total counts every line");
  assert.ok(text.includes(`Umumiy tushum: ${lines.length} so'm`), "and so does the revenue total");
});

test("the ForResult line names the board and quotes no fixed price", () => {
  const labels = adminTest.salesLines().map((l) => l.label);
  const adLine = labels.find((l) => l.includes("ForResult"));
  assert.ok(adLine, "the board must be reported by name");
  // It has no price to quote -- the buyer names the amount, which is the
  // whole point of it. A hardcoded figure here would be a lie.
  assert.ok(!/\d/.test(adLine.replace("ForResult", "")), `it must not quote a price: ${adLine}`);
});

// --- where the ad money actually came from -----------------------------------
//
// The aggregate line answers "how much did the board bring in". Without the
// payment-by-payment view, a jump in that number has no explanation at all --
// you cannot tell one large advertiser from twenty small ones, or spot a
// payment against an ad that has since been taken down.

test("the sales screen offers a way into the individual ad payments", async () => {
  const sent = await h.send(A(), h.textUpdate(SALES, admin));
  assert.ok(periodCallbacks(sent).includes("admin:sales:ads"), "the button must be on the sales screen");
});

test("each ad payment is listed with who paid, how much, and against which ad", async () => {
  const adId = await db.createAd({
    userId: "555000111", name: "Kofe Xona", about: "x", link: "https://x.com",
  });
  await db.addAdAmount(adId, 450000);
  seedPaidOrder("adboard", 450000, 1, { userId: "555000111", targetId: String(adId) });

  const text = said(await h.send(A(), h.callbackUpdate("admin:sales:ads", admin)));
  assert.match(text, /Kofe Xona/, "the ad it paid for");
  assert.match(text, /555000111/, "who paid");
  assert.ok(text.includes((450000).toLocaleString("uz-UZ")), "how much");
});

// The money happened even if the ad did not survive. Dropping the row would
// make the listed payments stop adding up to the reported total.
test("a payment against a deleted ad is still listed, marked as such", async () => {
  seedPaidOrder("adboard", 77000, 1, { userId: "444000222", targetId: "99999" });
  const text = said(await h.send(A(), h.callbackUpdate("admin:sales:ads", admin)));
  assert.ok(text.includes((77000).toLocaleString("uz-UZ")), "the payment is still shown");
  assert.match(text, /o'chirilgan/, "and flagged as belonging to an ad that is gone");
});

// The list is capped so a busy month cannot exceed Telegram's message limit.
// The headline figures must come from the full summary regardless, or the
// screen would quietly under-report the moment the cap is reached.
test("the headline totals count every payment, not just the ones shown", () => {
  const many = Array.from({ length: adminTest.AD_PAYMENTS_LIMIT }, (_, i) => ({
    targetId: "1", userId: "7", amount: 1000, provider: "click",
    paidAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
  const text = adminTest.formatAdPayments(many, new Map(), {
    total: 500,
    totalRevenue: 9999999,
    title: "barcha vaqt",
  });
  assert.match(text, /To'lovlar: <b>500<\/b> ta/, "the count is the real one");
  assert.ok(text.includes((9999999).toLocaleString("uz-UZ")), "and so is the revenue");
  assert.match(text, /oxirgi 20 tasi/, "while saying plainly that the list is capped");
});

// Driven through the real screen with MORE payments than it can show, which
// is the only condition under which "count the list" and "count everything"
// differ -- and therefore the only way to prove the headline is not just the
// length of the visible list.
test("past the cap, the headline still counts every payment", async () => {
  const before = (await getSalesSummary()).adboard.count;
  const extra = adminTest.AD_PAYMENTS_LIMIT + 2;
  for (let i = 0; i < extra; i++) {
    seedPaidOrder("adboard", 1000, 1, { userId: "333000444", targetId: "12345" });
  }
  const expected = before + extra;

  const text = said(await h.send(A(), h.callbackUpdate("admin:sales:ads", admin)));
  assert.match(
    text,
    new RegExp(`To'lovlar: <b>${expected}</b> ta`),
    `the header must count all ${expected}, not just the ${adminTest.AD_PAYMENTS_LIMIT} listed`
  );
  assert.match(text, /oxirgi 20 tasi/, "and say the list itself is capped");
});

test("a non-admin cannot open the ad payments", async () => {
  const outsider = user("NosyAds");
  await h.send(h.mainBot(), h.commandUpdate("/start", outsider));
  await h.send(h.mainBot(), h.callbackUpdate("lang:uz", outsider));
  const text = said(await h.send(A(), h.callbackUpdate("admin:sales:ads", outsider)));
  assert.ok(!/afishalar tushumi/i.test(text), "the screen must not open");
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
