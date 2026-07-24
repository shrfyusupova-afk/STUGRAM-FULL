const QRCode = require("qrcode");
const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { createOrder, buildCheckoutUrl, PREMIUM_PRICE_SOM } = require("./click");

// Shared by the "💎 Premium" menu button and the "👑 Premium'ga ulanish"
// button shown on the pay-per-view paywall (discover.js) -- both should open
// the exact same checkout, not two slightly different copies of it.
async function sendPremiumOffer(ctx) {
  const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
  const orderId = createOrder(ctx.from.id, { type: "premium" });
  const clickUrl = buildCheckoutUrl(orderId, PREMIUM_PRICE_SOM);

  const button = clickUrl
    ? Markup.button.url(t(lang, "premiumPayClickButton"), clickUrl)
    : Markup.button.callback(t(lang, "premiumPayClickButton"), "premium:pay:click:noop");

  await ctx.reply(t(lang, "premiumDetails"), Markup.inlineKeyboard([[button]]));

  if (clickUrl) {
    const qrBuffer = await QRCode.toBuffer(clickUrl, { width: 400, margin: 2 });
    await ctx.replyWithPhoto({ source: qrBuffer }, { caption: t(lang, "premiumQrCaption") });
  }
}

function registerPremiumHandlers(bot) {
  const premiumLabels = Object.values(STRINGS).map((dict) => dict.menu.premium);

  bot.hears(premiumLabels, sendPremiumOffer);

  bot.action("premium:offer", async (ctx) => {
    await ctx.answerCbQuery();
    await sendPremiumOffer(ctx);
  });

  bot.action("premium:pay:click:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.answerCbQuery();
    await ctx.reply(t(lang, "premiumPayClickNotConfigured"));
  });
}

module.exports = { registerPremiumHandlers, sendPremiumOffer };
