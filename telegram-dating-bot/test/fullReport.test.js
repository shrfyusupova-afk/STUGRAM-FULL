// The "📈 To'liq hisobot" button must keep working even when the AI
// assistant can't (no ANTHROPIC_API_KEY, no API credit, model outage) --
// it's a plain formatter over the same real snapshot, no model call
// involved. These tests catch it crashing on the edge cases real data
// actually produces: a brand new bot with zero users, and a bot where
// nobody joined in the prior 30-day window (division by zero in the
// growth-percent calculation).
const assert = require("assert");
const { __test } = require("../src/adminBot");
const { formatFullReport } = __test;

const baseSnapshot = (overrides = {}) => ({
  generatedAt: new Date().toISOString(),
  profiles: { total: 100, male: 60, female: 40, active: 90, pendingAnketa: 2, premiumNow: 10 },
  newRegistrationsLast30Days: { male: 12, female: 8, total: 20 },
  newRegistrationsPrior30Days: { male: 6, female: 4, total: 10 },
  salesAllTime: {
    premium: { count: 10, totalRevenue: 799000 },
    unlock: { count: 30, totalRevenue: 237000 },
    vipchat: { count: 5, totalRevenue: 299500 },
    anongender: { count: 8, totalRevenue: 103200 },
  },
  salesLast30Days: {
    premium: { count: 2, totalRevenue: 159800 },
    unlock: { count: 6, totalRevenue: 47400 },
    vipchat: { count: 1, totalRevenue: 59900 },
    anongender: { count: 2, totalRevenue: 25800 },
  },
  complaints: { total: 15, pending: 3, answered: 12 },
  ...overrides,
});

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("a normal snapshot renders every section without crashing", () => {
  const text = formatFullReport(baseSnapshot());
  assert.ok(text.includes("Jami: 100 ta"));
  assert.ok(text.includes("Jami tushum"));
  assert.ok(text.includes("Shikoyatlar"));
});

test("zero users anywhere does not throw a division-by-zero NaN%", () => {
  const empty = baseSnapshot({
    profiles: { total: 0, male: 0, female: 0, active: 0, pendingAnketa: 0, premiumNow: 0 },
    newRegistrationsLast30Days: { male: 0, female: 0, total: 0 },
    newRegistrationsPrior30Days: { male: 0, female: 0, total: 0 },
  });
  const text = formatFullReport(empty);
  assert.ok(!text.includes("NaN"), "a brand-new bot with no users must not render NaN%");
});

test("nobody joining in the prior 30 days does not divide by zero", () => {
  const noPriorGrowth = baseSnapshot({ newRegistrationsPrior30Days: { male: 0, female: 0, total: 0 } });
  const text = formatFullReport(noPriorGrowth);
  assert.ok(!text.includes("NaN"), "prior30.total === 0 must not produce NaN in the growth line");
  assert.ok(text.includes("yangi"), "the zero-prior-period case should say so in words, not show a bogus percentage");
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
