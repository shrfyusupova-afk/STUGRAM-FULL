// alerts.js exists to tell the operator something broke without them having
// to think to check /health -- so the two things worth proving are that it
// actually reaches them, and that nothing about sending the message can ever
// become a new way for the bot itself to fail.
process.env.ALERT_CHAT_ID = "555000111";

const assert = require("assert");
const { alert, configureAlerts, __test } = require("../src/alerts");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function fakeTelegram({ reject = false, hang = false } = {}) {
  const calls = [];
  return {
    calls,
    sendMessage: (chatId, text) => {
      calls.push({ chatId, text });
      if (hang) return new Promise(() => {}); // never resolves
      if (reject) return Promise.reject(new Error("Telegram says no"));
      return Promise.resolve({ message_id: 1 });
    },
  };
}

test("with no ALERT_CHAT_ID, alert() is a silent no-op", async () => {
  const saved = process.env.ALERT_CHAT_ID;
  delete process.env.ALERT_CHAT_ID;
  // ALERT_CHAT_ID is read once at module load, so this only proves the
  // "not configured" half of the guard (!telegramRef) -- the env var itself
  // is covered by every other test in this file actually sending.
  const tg = fakeTelegram();
  configureAlerts(null);
  await alert("should go nowhere");
  assert.strictEqual(tg.calls.length, 0);
  process.env.ALERT_CHAT_ID = saved;
});

test("a configured alert reaches the right chat with the right prefix", async () => {
  __test.resetThrottle();
  const tg = fakeTelegram();
  configureAlerts(tg);
  await alert("database is unreachable");
  assert.strictEqual(tg.calls.length, 1);
  assert.strictEqual(tg.calls[0].chatId, "555000111");
  assert.match(tg.calls[0].text, /^🚨 database is unreachable$/);
});

test("a second alert inside the throttle window is dropped", async () => {
  __test.resetThrottle();
  const tg = fakeTelegram();
  configureAlerts(tg);
  await alert("first");
  await alert("second, sixty seconds have not passed");
  assert.strictEqual(tg.calls.length, 1, "only the first one should have gone out");
});

test("bypassThrottle sends even inside the window -- the crash path's one shot", async () => {
  __test.resetThrottle();
  const tg = fakeTelegram();
  configureAlerts(tg);
  await alert("first");
  await alert("the process is dying", { bypassThrottle: true });
  assert.strictEqual(tg.calls.length, 2, "a crash alert must not be swallowed by an unrelated alert seconds earlier");
});

test("a message longer than Telegram's limit is truncated, not rejected by the API", async () => {
  __test.resetThrottle();
  const tg = fakeTelegram();
  configureAlerts(tg);
  await alert("x".repeat(10_000));
  assert.ok(tg.calls[0].text.length < 4096, "must stay under Telegram's own 4096 cap");
});

test("a rejected send is swallowed -- alerting must never throw", async () => {
  __test.resetThrottle();
  const tg = fakeTelegram({ reject: true });
  configureAlerts(tg);
  await assert.doesNotReject(() => alert("this send will fail"));
});

test("a hanging send does not hang the caller when timeoutMs is set", async () => {
  __test.resetThrottle();
  const tg = fakeTelegram({ hang: true });
  configureAlerts(tg);
  const started = Date.now();
  await alert("Telegram is not answering", { timeoutMs: 200 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1000, `alert() waited ${elapsed}ms -- the timeout should have cut it off near 200ms`);
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
