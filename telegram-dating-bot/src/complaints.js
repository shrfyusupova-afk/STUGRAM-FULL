const { Markup } = require("telegraf");
const { getLanguage, createComplaint } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { mainMenuKeyboard } = require("./menu");

// Where a complaint was filed from. Only affects the label the admin sees and
// whether a specific person is attached to it.
const SOURCE = {
  DISCOVER: "discover", // about the candidate currently on screen
  ANON: "anon", // about the partner from a just-finished anonymous chat
  GENERAL: "general", // from the main menu, about nothing in particular
};

// Who has tapped "report" and is expected to type their complaint next.
// userId -> { targetId, source }
//
// In memory on purpose: this only spans the few seconds between tapping the
// button and sending the message. A restart in that window just means the
// person taps the button again -- nothing filed is ever kept here, complaints
// themselves go straight to storage.
const pendingReports = new Map();

// The admin's reply is free text typed by a person, so it has to be escaped
// before going into an HTML-parsed message -- an unescaped "<" would make
// Telegram reject the whole send and the reporter would never hear back.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Five digits, as asked -- short enough to quote from memory or read out over
// the phone. Collisions are possible in a 90k space, so submitComplaint
// retries: createComplaint refuses a taken id rather than overwriting, which
// makes the check and the insert the same operation with no gap between them.
function randomComplaintId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// A prompt the person walked away from must not still be waiting hours later:
// without this, tapping "report" and then getting distracted meant their next
// ordinary message -- possibly the following day -- was silently filed as a
// complaint.
const REPORT_PROMPT_TTL_MS = 15 * 60 * 1000;

function beginReport(userId, { targetId = null, source }) {
  pendingReports.set(String(userId), {
    targetId: targetId ? String(targetId) : null,
    source,
    expiresAt: Date.now() + REPORT_PROMPT_TTL_MS,
  });
}

function cancelReport(userId) {
  pendingReports.delete(String(userId));
}

function pendingReportFor(userId) {
  const key = String(userId);
  const pending = pendingReports.get(key);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingReports.delete(key);
    return null;
  }
  return pending;
}

// A single cancel button, so anything else the person types is unambiguously
// the complaint itself rather than a menu tap that has to be guessed at.
function reportKeyboard(lang) {
  return Markup.keyboard([[t(lang, "backButton")]]).resize();
}

async function promptForComplaint(ctx, lang, { targetId = null, source }) {
  beginReport(ctx.from.id, { targetId, source });
  const prompt = targetId ? t(lang, "complaintPromptAbout") : t(lang, "complaintPromptGeneral");
  await ctx.reply(prompt, reportKeyboard(lang));
}

// Stores whatever the person just typed as their complaint and hands back the
// reference code. Returns null if the code space somehow can't produce a free
// id, so the caller can tell them to try again rather than pretend it worked.
async function submitComplaint(userId, text) {
  const pending = pendingReportFor(userId);
  if (!pending) return null;
  cancelReport(userId);

  for (let attempt = 0; attempt < 20; attempt++) {
    const id = randomComplaintId();
    const created = await createComplaint(id, {
      reporterId: userId,
      targetId: pending.targetId,
      source: pending.source,
      text,
    });
    if (created) return { id, ...pending };
  }
  return null;
}

function registerComplaintHandlers(bot) {
  const complaintLabels = Object.values(STRINGS).map((dict) => dict.menu.complaint);
  const backLabels = Object.values(STRINGS).map((dict) => dict.backButton);

  // Registered from index.js right after the anon-chat relay and BEFORE every
  // bot.hears, so a person who is mid-complaint has their message taken as the
  // complaint instead of being matched against a menu label that happens to
  // appear in their sentence.
  bot.on("text", async (ctx, next) => {
    const pending = pendingReportFor(ctx.from.id);
    if (!pending) return next();

    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;

    // The one escape hatch out of the prompt.
    if (backLabels.includes(ctx.message.text)) {
      cancelReport(ctx.from.id);
      await ctx.reply(t(lang, "complaintCancelled"), mainMenuKeyboard(lang));
      return;
    }

    const text = ctx.message.text.trim();
    if (text.length < 3) {
      await ctx.reply(t(lang, "complaintTooShort"));
      return;
    }

    const result = await submitComplaint(ctx.from.id, text);
    if (!result) {
      await ctx.reply(t(lang, "complaintFailed"), mainMenuKeyboard(lang));
      return;
    }
    await ctx.reply(t(lang, "complaintReceived")(result.id), {
      parse_mode: "HTML",
      ...mainMenuKeyboard(lang),
    });
    console.log(`Complaint ${result.id} filed by ${ctx.from.id} (source: ${result.source}, target: ${result.targetId || "-"})`);
  });

  // Main-menu entry: a complaint about nothing in particular.
  bot.hears(complaintLabels, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await promptForComplaint(ctx, lang, { source: SOURCE.GENERAL });
  });

  // Tapped from the discover screen, about whoever is on screen right now.
  bot.action(/^report:user:(.+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await promptForComplaint(ctx, lang, { targetId: ctx.match[1], source: SOURCE.DISCOVER });
  });

  // Offered right after an anonymous chat ends, about that partner.
  bot.action(/^report:anon:(.+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await promptForComplaint(ctx, lang, { targetId: ctx.match[1], source: SOURCE.ANON });
  });
}

// Delivered to the person who filed the complaint once an admin answers it.
async function deliverAdminReply(telegram, complaint) {
  const lang = (await getLanguage(complaint.reporterId)) || DEFAULT_LANG;
  await telegram.sendMessage(
    complaint.reporterId,
    t(lang, "complaintAnswered")(complaint.id, escapeHtml(complaint.adminReply)),
    { parse_mode: "HTML", ...mainMenuKeyboard(lang) }
  );
}

module.exports = {
  registerComplaintHandlers,
  promptForComplaint,
  deliverAdminReply,
  pendingReportFor,
  SOURCE,
};
