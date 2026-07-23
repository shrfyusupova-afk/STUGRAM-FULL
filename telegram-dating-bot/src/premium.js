const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");

// Real payment processing isn't wired up yet (no payment provider set up) --
// the pay button lands on a placeholder for now, matching the same pattern
// as the discover "unlock chat" button.
function registerPremiumHandlers(bot) {
  const premiumLabels = Object.values(STRINGS).map((dict) => dict.menu.premium);

  bot.hears(premiumLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.reply(
      t(lang, "premiumDetails"),
      Markup.inlineKeyboard([[Markup.button.callback(t(lang, "premiumPayButton"), "premium:pay:noop")]])
    );
  });

  bot.action("premium:pay:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.answerCbQuery();
    await ctx.reply(t(lang, "premiumPayPlaceholder"));
  });
}

module.exports = { registerPremiumHandlers };
