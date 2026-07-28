const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG } = require("./i18n");
const { promptForComplaint, SOURCE } = require("./complaints");

// Told to someone by an admin's action, delivered through the MAIN bot --
// the admin bot is a bot these people have never opened, so a message from it
// would never arrive. Everything an admin does TO a user goes through here so
// there is one place that gets that right.

// The two ways out of a deletion, exactly as offered under the message.
function noticeKeyboard(lang, { offerNewProfile }) {
  const rows = [];
  if (offerNewProfile) rows.push([Markup.button.callback(t(lang, "newProfileButton"), "account:new")]);
  rows.push([Markup.button.callback(t(lang, "complainButton"), "account:report")]);
  return Markup.inlineKeyboard(rows);
}

async function notifyUser(mainBotTelegram, userId, textKey, { offerNewProfile = false } = {}) {
  const lang = (await getLanguage(userId)) || DEFAULT_LANG;
  // Blocking the bot or deleting the account is normal here -- the admin's
  // action has already been applied, so a failure to tell them must not
  // undo it or surface as an error in the admin panel.
  await mainBotTelegram.sendMessage(userId, t(lang, textKey), {
    parse_mode: "HTML",
    ...noticeKeyboard(lang, { offerNewProfile }),
  });
}

function notifyAccountDeleted(mainBotTelegram, userId) {
  return notifyUser(mainBotTelegram, userId, "accountDeleted", { offerNewProfile: true });
}

function notifyAccountDeactivated(mainBotTelegram, userId) {
  return notifyUser(mainBotTelegram, userId, "accountDeactivated");
}

async function notifyAccountReactivated(mainBotTelegram, userId) {
  const lang = (await getLanguage(userId)) || DEFAULT_LANG;
  await mainBotTelegram.sendMessage(userId, t(lang, "accountReactivated"), { parse_mode: "HTML" });
}

// Registered on the MAIN bot: the buttons above are attached to its messages,
// so it is the bot that receives the taps.
//
// startNewProfile is index.js's own /start behaviour, passed in rather than
// duplicated -- "Yangi profil ochish" has to be exactly the same thing as
// pressing /start, not a second path that can drift away from it.
function registerAccountNoticeHandlers(bot, { startNewProfile, safeAnswerCbQuery }) {
  bot.action("account:new", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await startNewProfile(ctx);
  });

  bot.action("account:report", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await promptForComplaint(ctx, lang, { source: SOURCE.GENERAL });
  });
}

module.exports = {
  notifyAccountDeleted,
  notifyAccountDeactivated,
  notifyAccountReactivated,
  registerAccountNoticeHandlers,
};
