const { Markup } = require("telegraf");
const { t } = require("./i18n");

// A persistent bottom (reply) keyboard, not an inline keyboard attached to
// one chat message -- stays docked under the input box across the whole
// conversation instead of scrolling away with the chat.
//
// The Mini App is deliberately NOT a button here. It is reachable from the
// Menu button beside the input box (set once in index.js via
// setChatMenuButton), which is where Telegram itself puts a Mini App, so
// duplicating it in the keyboard only made this menu longer.
function mainMenuKeyboard(lang) {
  const m = t(lang, "menu");
  return Markup.keyboard([
    [m.discover, m.profile],
    [m.likes, m.vip],
    [m.premium, m.anonChat],
    // Invite sits next to the complaint row rather than at the top: it is the
    // free route to a paid feature, so it should be findable without being
    // the first thing pushed at someone who just arrived.
    [m.referral, m.complaint],
  ])
    .resize()
    .persistent();
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
