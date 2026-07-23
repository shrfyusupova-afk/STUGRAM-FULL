const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { createOrder, buildCheckoutUrl } = require("./click");

// Payme processing isn't wired up yet -- its button lands on a placeholder.
// Click IS wired up (webhook + signature verification in click.js), but the
// checkout link itself only works once CLICK_MERCHANT_ID/CLICK_SERVICE_ID
// are configured (buildCheckoutUrl returns null until then).
function registerPremiumHandlers(bot) {
  const premiumLabels = Object.values(STRINGS).map((dict) => dict.menu.premium);

  bot.hears(premiumLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const orderId = createOrder(ctx.from.id);
    const clickUrl = buildCheckoutUrl(orderId);

    const buttons = [[Markup.button.callback(t(lang, "premiumPayButton"), "premium:pay:noop")]];
    buttons.push(
      clickUrl
        ? [Markup.button.url(t(lang, "premiumPayClickButton"), clickUrl)]
        : [Markup.button.callback(t(lang, "premiumPayClickButton"), "premium:pay:click:noop")]
    );

    await ctx.reply(t(lang, "premiumDetails"), Markup.inlineKeyboard(buttons));
  });

  bot.action("premium:pay:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.answerCbQuery();
    await ctx.reply(t(lang, "premiumPayPlaceholder"));
  });

  bot.action("premium:pay:click:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.answerCbQuery();
    await ctx.reply(t(lang, "premiumPayClickNotConfigured"));
  });
}

module.exports = { registerPremiumHandlers };
