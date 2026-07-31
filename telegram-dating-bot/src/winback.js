// Bringing back people who stopped opening the bot.
//
// Two messages, three days apart and seven days apart, and then nothing. A
// campaign that keeps going is a campaign people block, and a blocked user is
// lost for every future message too -- including the ones that matter, like a
// match. So the sequence has an end, every message carries a way out, and the
// whole thing resets the moment somebody comes back.
//
// The numbers in the copy are REAL, counted from the database at send time.
// "New people joined!" with nothing behind it teaches somebody in one message
// that these are noise; "14 new profiles since you left" is worth opening,
// and it stays worth opening because it stays true. When the count is zero
// nothing is sent at all -- there is genuinely no news, and saying otherwise
// is how a bot earns its mute.
const { Markup } = require("telegraf");
const {
  listWinbackTargets,
  markWinbackSent,
  markBotBlocked,
  setNotificationsEnabled,
  countNewProfilesSince,
  getLanguage,
} = require("./db");
const { t, DEFAULT_LANG } = require("./i18n");
const { isGoneError, retryAfterMs } = require("./telegramSafety");
const { pendingLikerCount } = require("./discover");

// Day 3 while the bot is still a recent memory, day 7 as the last word.
const STAGES = [3, 7];
const DAY_MS = 24 * 60 * 60 * 1000;

// Tashkent is UTC+5 and does not change. A "come back, people are waiting"
// message at four in the morning is an unsubscribe, not a reminder.
const TASHKENT_OFFSET_HOURS = 5;
const SEND_FROM_HOUR = 10;
const SEND_UNTIL_HOUR = 21;

// Telegram's documented ceiling for bulk sending is about 30 messages a
// second; staying under it costs nothing and a 429 costs the whole batch's
// pacing. 45ms is roughly 22/s.
const SEND_GAP_MS = 45;

// One pass never touches more than this, so a big idle population is worked
// through over several passes instead of one long burst that blocks nothing
// but still holds a database connection for minutes.
const BATCH_LIMIT = 200;

// Often enough that the 10:00 window is caught soon after it opens, rare
// enough to be invisible.
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tashkentHour(now = new Date()) {
  return (now.getUTCHours() + TASHKENT_OFFSET_HOURS) % 24;
}

function withinSendingHours(now = new Date()) {
  const hour = tashkentHour(now);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

function oppositeGender(gender) {
  return gender === "male" ? "female" : "male";
}

// isGone / retryAfterMs live in telegramSafety.js: the broadcast needs the
// same two answers and the two senders must not disagree about them.
const isGone = isGoneError;

function keyboard(lang) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, "winbackBrowseButton"), "winback:browse")],
    [Markup.button.callback(t(lang, "winbackMuteButton"), "winback:mute")],
  ]);
}

// Returns the message, or null when there is nothing honest to say.
async function composeMessage(target, stage) {
  const lang = (await getLanguage(target.userId)) || DEFAULT_LANG;
  const since = new Date(Date.now() - stage * DAY_MS).toISOString();

  const [fresh, waiting] = await Promise.all([
    countNewProfilesSince(oppositeGender(target.gender), since),
    pendingLikerCount(target.userId),
  ]);

  // Somebody actually liked them while they were away. That is the strongest
  // thing this bot can ever say, so it leads -- and it is specific to them,
  // which no amount of "new people joined" ever is.
  if (waiting > 0) {
    return { lang, text: t(lang, "winbackWaiting")({ name: target.name, waiting, days: stage }) };
  }
  if (fresh > 0) {
    const key = stage >= 7 ? "winbackFreshWeek" : "winbackFresh";
    return { lang, text: t(lang, key)({ name: target.name, fresh, gender: target.gender, days: stage }) };
  }
  // Nothing new and nobody waiting. Say nothing; the stage is still marked so
  // this person is not re-examined every half hour for the same non-answer.
  return null;
}

async function runStage(telegram, stage) {
  const before = new Date(Date.now() - stage * DAY_MS).toISOString();
  const targets = await listWinbackTargets(stage, before, BATCH_LIMIT);
  let sent = 0;

  for (const target of targets) {
    // Marked first, whatever happens next. A crash between sending and
    // marking would otherwise send the same person the same message on the
    // next pass, forever -- the one failure mode of a campaign like this that
    // users actually notice.
    await markWinbackSent(target.userId, stage);

    let message;
    try {
      message = await composeMessage(target, stage);
    } catch (err) {
      console.error(`winback compose failed for ${target.userId}:`, err.message);
      continue;
    }
    if (!message) continue;

    try {
      await telegram.sendMessage(target.userId, message.text, {
        parse_mode: "HTML",
        ...keyboard(message.lang),
      });
      sent++;
    } catch (err) {
      if (isGone(err)) {
        await markBotBlocked(target.userId).catch(() => {});
        continue;
      }
      const wait = retryAfterMs(err);
      if (wait) {
        console.warn(`winback rate limited, waiting ${wait}ms`);
        await sleep(wait);
        // One retry. If it fails again the stage is already marked, so this
        // person is simply skipped rather than blocking everyone behind them.
        try {
          await telegram.sendMessage(target.userId, message.text, {
            parse_mode: "HTML",
            ...keyboard(message.lang),
          });
          sent++;
        } catch (retryErr) {
          console.error(`winback retry failed for ${target.userId}:`, retryErr.message);
        }
        continue;
      }
      console.error(`winback send failed for ${target.userId}:`, err.message);
    }

    await sleep(SEND_GAP_MS);
  }

  return { examined: targets.length, sent };
}

async function runOnce(telegram, { force = false } = {}) {
  if (!force && !withinSendingHours()) return { skipped: "outside sending hours" };

  const totals = { examined: 0, sent: 0 };
  // Later stages first: somebody who has drifted for a week should get the
  // week message, not the three-day one they already missed.
  for (const stage of [...STAGES].sort((a, b) => b - a)) {
    try {
      const result = await runStage(telegram, stage);
      totals.examined += result.examined;
      totals.sent += result.sent;
    } catch (err) {
      console.error(`winback stage ${stage} failed:`, err.message);
    }
  }
  if (totals.sent) console.log(`Win-back: ${totals.sent} message(s) sent, ${totals.examined} examined.`);
  return totals;
}

// Runs inside the existing process on a timer. Deliberately NOT a second
// Render service: the free plan bills instance-hours per account, and a
// second always-on service would put the pair over the monthly allowance and
// stop them both.
function startWinbackSweeper(telegram) {
  const tick = () => {
    runOnce(telegram).catch((err) => console.error("winback sweep failed:", err.message));
  };
  tick();
  setInterval(tick, SWEEP_INTERVAL_MS).unref();
  console.log(
    `Win-back: sweeping every ${SWEEP_INTERVAL_MS / 60000} min, sending ${SEND_FROM_HOUR}:00-${SEND_UNTIL_HOUR}:00 Tashkent time.`
  );
}

function registerWinbackHandlers(bot, { openDiscovery }) {
  bot.action("winback:browse", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await openDiscovery(ctx);
  });

  bot.action("winback:mute", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await ctx.answerCbQuery().catch(() => {});
    await setNotificationsEnabled(ctx.from.id, false);
    await ctx.reply(t(lang, "winbackMuted"), { parse_mode: "HTML" });
  });
}

module.exports = {
  STAGES,
  SEND_FROM_HOUR,
  SEND_UNTIL_HOUR,
  withinSendingHours,
  tashkentHour,
  isGone,
  retryAfterMs,
  composeMessage,
  runOnce,
  startWinbackSweeper,
  registerWinbackHandlers,
};
