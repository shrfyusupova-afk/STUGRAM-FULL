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
    // Its own full-width row, high up: it is the one screen here that people
    // are meant to arrive at without already knowing it exists, and a
    // half-width button in the fifth row is not something anybody discovers.
    [m.forResult],
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

  // The board's own advert, on every return to the main menu -- that
  // repetition is the product being sold to the people who buy slots on it,
  // so it belongs here rather than only on the board's own screen.
  //
  // Required lazily and failure-tolerant on purpose: this is a promo, and a
  // promo that fails must never be the reason somebody cannot get back to
  // their menu. Lazy because forResult.js needs mainMenuKeyboard from
  // here, and a top-level require in both directions is a cycle -- the same
  // pattern vipChat.js/vipInvite.js already use.
  try {
    await require("./forResult").sendPromo(ctx, lang);
  } catch (err) {
    console.error("ForResult promo failed (ignored):", err.message);
  }
}

// Every main-menu button now has a real handler registered by its own
// module (discover.js, likes.js, profileSettings.js, premium.js, vipChat.js,
// anonChat.js) -- there's nothing left for a generic placeholder loop to
// cover.
function registerMenuHandlers() {}

module.exports = { mainMenuKeyboard, sendMainMenu, registerMenuHandlers };
