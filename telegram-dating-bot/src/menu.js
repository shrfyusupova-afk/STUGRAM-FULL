const { Markup } = require("telegraf");
const { STRINGS, DEFAULT_LANG, t } = require("./i18n");
const { getLanguage } = require("./db");

// A persistent bottom (reply) keyboard, not an inline keyboard attached to
// one chat message -- stays docked under the input box across the whole
// conversation instead of scrolling away with the chat.
function mainMenuKeyboard(lang) {
  const m = t(lang, "menu");
  return Markup.keyboard([
    [m.discover, m.profile],
    [m.likes, m.vip],
    [m.premium],
  ])
    .resize()
    .persistent();
}

async function sendMainMenu(ctx, profile, lang) {
  await ctx.reply(t(lang, "profileSaved")(profile), mainMenuKeyboard(lang));
}

// Menu button labels are localized, so a single user's keyboard only shows
// one language's labels -- but bot.hears must recognize the label no matter
// which language it was rendered in, since different users can be on
// different languages at the same time.
// "discover", "likes", "profile", and "premium" are deliberately excluded
// here -- discover.js, likes.js, profileSettings.js, and premium.js register
// the real handlers for those buttons instead of a placeholder reply.
function registerMenuHandlers(bot) {
  const KEYS = ["vip"];

  for (const key of KEYS) {
    const labelsForKey = Object.values(STRINGS).map((dict) => dict.menu[key]);
    bot.hears(labelsForKey, async (ctx) => {
      const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
      await ctx.reply(t(lang, "menuPlaceholders")[key]);
    });
  }
}

module.exports = { mainMenuKeyboard, sendMainMenu, registerMenuHandlers };
