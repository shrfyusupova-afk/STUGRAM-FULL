const { Markup } = require("telegraf");
const { t } = require("./i18n");
const { getPublicUrl } = require("./botInfo");

// A persistent bottom (reply) keyboard, not an inline keyboard attached to
// one chat message -- stays docked under the input box across the whole
// conversation instead of scrolling away with the chat.
//
// The cabinet is a web_app button, which reply keyboards support: tapping it
// opens the Mini App in place rather than sending any text, so it needs no
// bot.hears() handler at all. Telegram only accepts an HTTPS URL for one, so
// it is omitted entirely when running locally with no public domain -- the
// rest of the menu is unaffected.
function mainMenuKeyboard(lang) {
  const m = t(lang, "menu");
  const publicUrl = getPublicUrl();
  const rows = [
    [m.discover, m.profile],
    [m.likes, m.vip],
    [m.premium, m.anonChat],
  ];
  rows.push(publicUrl ? [Markup.button.webApp(m.cabinet, `${publicUrl}/app`), m.complaint] : [m.complaint]);
  return Markup.keyboard(rows).resize().persistent();
}

// Neutral "you're at the main menu" -- used whenever we're just returning
// someone here (Back button, re-selecting a language, backing out of an
// edit). Does NOT claim anything was just saved -- only profileWizard.js's
// finish() does that, and only right after it actually happened.
async function sendMainMenu(ctx, lang) {
  await ctx.reply(t(lang, "mainMenuIntro"), mainMenuKeyboard(lang));
}

// Every main-menu button now has a real handler registered by its own
// module (discover.js, likes.js, profileSettings.js, premium.js, vipChat.js,
// anonChat.js) -- there's nothing left for a generic placeholder loop to
// cover.
function registerMenuHandlers() {}

module.exports = { mainMenuKeyboard, sendMainMenu, registerMenuHandlers };
