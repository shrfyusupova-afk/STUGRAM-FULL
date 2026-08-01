// Sends the operator a Telegram message when something goes wrong that
// nobody would otherwise notice until a user complained -- a broadcast that
// failed outright, a payment delivery that could not be recovered, a process
// about to exit. /health can only be read by someone who thinks to check it;
// this reaches the operator instead of waiting to be asked.
//
// Two rules shape everything below:
//   1. Alerting must never be a NEW way for the bot to fail. Every path here
//      catches its own errors and resolves; nothing this module does is ever
//      allowed to throw or hang the caller.
//   2. One bad minute must not become a wall of identical messages. A single
//      throttle window covers everything -- simple, and enough for an
//      operator's phone to stay usable during an incident instead of buzzing
//      once per failed send inside a broadcast loop.
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID || null;
const THROTTLE_MS = 60 * 1000;
// Telegram's own limit is 4096; this leaves headroom for the prefix and for
// truncation itself never producing an over-length message by a few bytes.
const MAX_LEN = 3500;

let telegramRef = null;
let lastSentAt = 0;

// Called once at startup with whichever bot's Telegram client should carry
// these -- see index.js for which one that is and why. Nothing before this
// call can send anything; alert() just no-ops until it is configured.
function configureAlerts(telegram) {
  telegramRef = telegram;
}

// bypassThrottle exists for exactly one caller: the uncaughtException
// handler. Everywhere else, one throttle window is correct -- a process that
// is about to exit only ever gets one chance to say so, and losing that one
// message to an unrelated alert sixty seconds earlier would be worse than
// the noise the throttle exists to prevent.
async function alert(message, { bypassThrottle = false, timeoutMs = null } = {}) {
  if (!ALERT_CHAT_ID || !telegramRef) return;

  const now = Date.now();
  if (!bypassThrottle && now - lastSentAt < THROTTLE_MS) return;
  lastSentAt = now;

  const text = `🚨 ${String(message).slice(0, MAX_LEN)}`;
  const send = telegramRef.sendMessage(ALERT_CHAT_ID, text).catch((err) => {
    console.error("alert() failed to send (ignored):", err.message);
  });

  if (!timeoutMs) {
    await send;
    return;
  }
  // A timed-out send is left to resolve in the background rather than
  // cancelled -- there is no way to cancel an in-flight Telegram API call,
  // and letting it finish costs nothing once the caller has stopped waiting.
  await Promise.race([send, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

module.exports = {
  alert,
  configureAlerts,
  ALERT_CHAT_ID,
  // The throttle window is module-level state, which a require() cache
  // would otherwise leak between test cases -- this is the only way to get
  // back to "no alert sent yet" without re-requiring the module.
  __test: { resetThrottle: () => { lastSentAt = 0; } },
};
