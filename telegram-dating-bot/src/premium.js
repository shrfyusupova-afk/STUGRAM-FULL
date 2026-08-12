const QRCode = require("qrcode");
const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { PREMIUM_PRICE_SOM } = require("./orders");
const { buildPaymentOptions, paymentRows } = require("./checkout");
const { safeAnswerCbQuery } = require("./telegramSafety");

// Shared by the "💎 Premium" menu button and the "👑 Premium'ga ulanish"
// button shown on the pay-per-view paywall (discover.js) -- both should open
// the exact same checkout, not two slightly different copies of it.
async function sendPremiumOffer(ctx) {
  const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
  const { options, configured } = await buildPaymentOptions(ctx.from.id, {
    type: "premium",
    amountSom: PREMIUM_PRICE_SOM,
    lang,
    t,
  });

  if (!configured) {
    await ctx.reply(
      t(lang, "premiumDetails"),
      Markup.inlineKeyboard([[Markup.button.callback(t(lang, "premiumPayClickButton"), "premium:pay:click:noop")]])
    );
    return;
  }

  await ctx.reply(t(lang, "premiumDetails"), Markup.inlineKeyboard(paymentRows(options)));

  // The QR is for the FIRST configured provider only: one code per screen,
  // since a phone camera cannot be pointed at two at once and a second one
  // would just be a thing to scan by mistake.
  const qrBuffer = await QRCode.toBuffer(options[0].url, { width: 400, margin: 2 });
  await ctx.replyWithPhoto({ source: qrBuffer }, { caption: t(lang, "premiumQrCaption") });
}

function registerPremiumHandlers(bot) {
  const premiumLabels = Object.values(STRINGS).map((dict) => dict.menu.premium);

  bot.hears(premiumLabels, sendPremiumOffer);

  bot.action("premium:offer", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await sendPremiumOffer(ctx);
  });

  bot.action("premium:pay:click:noop", async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "premiumPayClickNotConfigured"));
  });
}

module.exports = { registerPremiumHandlers, sendPremiumOffer };
