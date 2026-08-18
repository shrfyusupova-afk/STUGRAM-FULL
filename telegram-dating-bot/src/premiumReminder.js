// Telling somebody their Premium is running out, before it does.
//
// A subscription that ends without warning is experienced as something being
// taken away -- the person notices when a feature they were using stops
// working, which is the worst possible moment and the worst possible framing.
// Four messages, spaced so the last week is a conversation rather than a
// surprise: a week out, five days, three days, and the day it ends.
//
// The tone is deliberately a friend's, not a billing system's. Somebody who
// has already paid once does not need to be sold to again; they need to be
// reminded, and given one tap to carry on.
const { Markup } = require("telegraf");
const {
  getLanguage,
  getProfile,
  listPremiumExpiring,
  setPremiumNoticeAt,
  clearRenewedPremiumNotices,
  markBotBlocked,
} = require("./db");
const { t, DEFAULT_LANG } = require("./i18n");
const { isGoneError, retryAfterMs } = require("./telegramSafety");

// These messages are HTML and put a name the person typed themselves inside
// it. Unescaped, a name with < or & reads as a broken tag and Telegram
// refuses the whole message -- so the reminder silently never arrives, and
// the marker has already been moved, so it never arrives on a later sweep
// either.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The days-remaining marks that get a message. Ordered high to low; the
// bucket a person falls into is the smallest mark they are still above.
const MARKS = [7, 5, 3, 0];

// Tashkent is UTC+5 and does not change. "Your subscription ends tomorrow" at
// four in the morning is a notification people turn off.
const TASHKENT_OFFSET_HOURS = 5;
const SEND_FROM_HOUR = 10;
const SEND_UNTIL_HOUR = 21;

const SEND_GAP_MS = 45;
const BATCH_LIMIT = 200;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tashkentHour(now = new Date()) {
  return (now.getUTCHours() + TASHKENT_OFFSET_HOURS) % 24;
}

function withinSendingHours(now = new Date()) {
  const hour = tashkentHour(now);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

// Whole days left, rounded UP: with 2.4 days to go a person thinks of it as
// three days, not two. Rounding down would make the "3 kun qoldi" message
// arrive on the day it says two.
function daysLeft(premiumUntil, now = Date.now()) {
  const until = new Date(premiumUntil).getTime();
  if (!Number.isFinite(until)) return null;
  return Math.ceil((until - now) / DAY_MS);
}

// Which of the four messages is due, or null when none is.
//
// The mark is the SMALLEST one the remaining days still fit inside: 6 or 7
// days left is the week message, 4 or 5 the five-day one, 1 to 3 the three-day
// one, and anything at or past the end is the "it has ended" one. Ascending
// order is what makes that a single pass -- and it means somebody who was
// away when the week message was due still gets the five-day one rather than
// a stale message about a week that has already gone.
const POSITIVE_MARKS = [3, 5, 7];

function markFor(left) {
  if (left === null) return null;
  if (left <= 0) return 0;
  for (const mark of POSITIVE_MARKS) {
    if (left <= mark) return mark;
  }
  return null;
}

function keyboard(lang, mark) {
  const label = mark === 0 ? t(lang, "premiumRenewExpiredButton") : t(lang, "premiumRenewButton");
  return Markup.inlineKeyboard([[Markup.button.callback(label, "premium:offer")]]);
}

// The message itself. `name` is used because these read as a note from a
// person, and a note from a person uses your name.
function composeMessage(lang, mark, name) {
  if (mark === 7) return t(lang, "premiumEnding7")(name);
  if (mark === 5) return t(lang, "premiumEnding5")(name);
  if (mark === 3) return t(lang, "premiumEnding3")(name);
  return t(lang, "premiumEnded")(name);
}

async function sendOne(telegram, userId, text, lang, mark) {
  const extra = { parse_mode: "HTML", ...keyboard(lang, mark) };
  try {
    await telegram.sendMessage(userId, text, extra);
    return true;
  } catch (err) {
    if (isGoneError(err)) {
      await markBotBlocked(userId).catch(() => {});
      return false;
    }
    const wait = retryAfterMs(err);
    if (wait) {
      console.warn(`premium reminder rate limited, waiting ${wait}ms`);
      await sleep(wait);
      try {
        await telegram.sendMessage(userId, text, extra);
        return true;
      } catch (retryErr) {
        console.error(`premium reminder retry failed for ${userId}:`, retryErr.message);
        return false;
      }
    }
    console.error(`premium reminder failed for ${userId}:`, err.message);
    return false;
  }
}

async function runOnce(telegram, { force = false } = {}) {
  // Renewals first. Putting the end date back out of reach has to clear the
  // marker, or the next cycle would find "already told them about 7 days"
  // still standing and stay silent all the way to the new expiry.
  try {
    const cleared = await clearRenewedPremiumNotices();
    if (cleared) console.log(`Premium reminders: reset for ${cleared} renewed subscription(s).`);
  } catch (err) {
    console.error("premium reminder reset failed:", err.message);
  }

  if (!force && !withinSendingHours()) return { skipped: "outside sending hours" };

  let targets;
  try {
    targets = await listPremiumExpiring(BATCH_LIMIT);
  } catch (err) {
    console.error("premium reminder listing failed:", err.message);
    return { examined: 0, sent: 0 };
  }

  let sent = 0;
  for (const target of targets) {
    const mark = markFor(daysLeft(target.premiumUntil));
    // Nothing due, or this exact message already went out. The marker moves
    // only downwards through 7 -> 5 -> 3 -> 0, so each is sent once per
    // subscription and a repeat is impossible without a renewal in between.
    if (mark === null || mark === target.noticeAt) continue;

    // Recorded BEFORE sending. A crash between the two costs one message;
    // the other order would re-send the same message on every sweep forever,
    // which is the failure people actually notice and mute the bot over.
    await setPremiumNoticeAt(target.userId, mark);

    const [lang, profile] = await Promise.all([
      getLanguage(target.userId).catch(() => null),
      getProfile(target.userId).catch(() => null),
    ]);
    const text = composeMessage(lang || DEFAULT_LANG, mark, escapeHtml(profile?.name || ""));

    if (await sendOne(telegram, target.userId, text, lang || DEFAULT_LANG, mark)) sent++;
    await sleep(SEND_GAP_MS);
  }

  if (sent) console.log(`Premium reminders: ${sent} sent, ${targets.length} examined.`);
  return { examined: targets.length, sent };
}

// In this process on a timer, for the same reason the win-back sweeper is:
// a second Render service would put the pair over the free plan's monthly
// instance-hours and stop them both.
function startPremiumReminders(telegram) {
  const tick = () => {
    runOnce(telegram).catch((err) => console.error("premium reminder sweep failed:", err.message));
  };
  tick();
  setInterval(tick, SWEEP_INTERVAL_MS).unref();
  console.log(
    `Premium reminders: sweeping hourly, sending ${SEND_FROM_HOUR}:00-${SEND_UNTIL_HOUR}:00 Tashkent time.`
  );
}

module.exports = {
  startPremiumReminders,
  runOnce,
  __test: { daysLeft, markFor, composeMessage, MARKS, withinSendingHours },
};
