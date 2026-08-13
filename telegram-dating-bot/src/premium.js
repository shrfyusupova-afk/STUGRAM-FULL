const QRCode = require("qrcode");
const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { PREMIUM_PRICE_SOM } = require("./orders");
const { buildPaymentOptions, paymentRows, PROVIDER_LABELS } = require("./checkout");
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
      Markup.inlineKeyboard([[Markup.button.callback(t(lang, "payButtonGeneric"), "payments:noop")]])
    );
    return;
  }

  await ctx.reply(t(lang, "premiumDetails"), Markup.inlineKeyboard(paymentRows(options)));

  // One QR per screen -- a phone camera cannot be pointed at two at once, and
  // a second code would only be something to scan by mistake. Which provider
  // it belongs to is named in the caption, so nobody opens the wrong app.
  const qrBuffer = await QRCode.toBuffer(options[0].url, { width: 400, margin: 2 });
  await ctx.replyWithPhoto(
    { source: qrBuffer },
    { caption: t(lang, "qrCaptionFor")(PROVIDER_LABELS[options[0].key] || options[0].key) }
  );
}

function registerPremiumHandlers(bot) {
  const premiumLabels = Object.values(STRINGS).map((dict) => dict.menu.premium);

  bot.hears(premiumLabels, sendPremiumOffer);

  bot.action("premium:offer", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await sendPremiumOffer(ctx);
  });

}

module.exports = { registerPremiumHandlers, sendPremiumOffer };
