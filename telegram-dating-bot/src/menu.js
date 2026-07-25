const { Markup } = require("telegraf");
const { t } = require("./i18n");

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

// Every main-menu button now has a real handler registered by its own
// module (discover.js, likes.js, profileSettings.js, premium.js, vipChat.js)
// -- there's nothing left for a generic placeholder loop to cover.
function registerMenuHandlers() {}

module.exports = { mainMenuKeyboard, sendMainMenu, registerMenuHandlers };
