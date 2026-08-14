const { Markup } = require("telegraf");
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { PREMIUM_PRICE_SOM } = require("./orders");
const { buildPaymentOptions, withPaymentNote } = require("./checkout");
const { safeAnswerCbQuery } = require("./telegramSafety");

// Shared by the "💎 Premium" menu button and the "👑 Premium'ga ulanish"
// button shown on the pay-per-view paywall (discover.js) -- both should open
// the exact same checkout, not two slightly different copies of it.
async function sendPremiumOffer(ctx) {
  const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
  const { rows, note, configured } = await buildPaymentOptions(ctx.from.id, {
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

  // One message, one tap to pay. The QR code that used to follow this was a
  // second message offering a second way to do the same thing, on a screen
  // where the person is already holding the phone the button is on -- it read
  // as an extra step rather than a convenience.
  await ctx.reply(withPaymentNote(t(lang, "premiumDetails"), note), Markup.inlineKeyboard(rows));
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
