// Builds the payment buttons shown on every paywall.
//
// One place, because "which providers can this person pay with" is a single
// question with a single answer, and five screens each deciding it for
// themselves is exactly how one of them ends up missing a provider after the
// next change. Every paywall in the app calls this.
const { Markup } = require("telegraf");
const { createOrder } = require("./orders");
const clickProvider = require("./click");
const paymeProvider = require("./payme");

// How each provider is named to a user, for the places a label is needed
// outside a button (the QR caption). Not translated: these are brand names.
const PROVIDER_LABELS = { click: "Click", payme: "Payme" };

// Order matters only in that it is the order the buttons appear in.
const PROVIDERS = [
  { key: "click", label: "click", build: clickProvider.buildCheckoutUrl },
  { key: "payme", label: "payme", build: paymeProvider.buildCheckoutUrl },
];

// Creates (or reuses) the order and returns one button per configured
// provider, plus the order id and the urls for anything else that needs them.
//
// The SAME order id goes to every provider: the person is buying one thing,
// and whichever checkout they actually complete settles that one order. A
// provider that is not configured simply contributes no button rather than a
// dead one.
async function buildPaymentOptions(userId, { type, targetId, amountSom, lang, t }) {
  const orderId = await createOrder(userId, { type, targetId });

  const options = [];
  for (const provider of PROVIDERS) {
    const url = provider.build(orderId, amountSom);
    if (!url) continue;
    options.push({
      key: provider.key,
      url,
      button: Markup.button.url(t(lang, `payWith_${provider.label}`), url),
    });
  }

  return { orderId, options, configured: options.length > 0 };
}

// The keyboard rows for a paywall: one button per provider, stacked, so each
// stays wide enough to read on a phone. Callers append their own extra rows
// (e.g. "use a free credit", "get Premium instead").
function paymentRows(options) {
  return options.map((option) => [option.button]);
}

// Every paywall falls back to the same button when NO provider is
// configured, so there is one place that answers "why can't I pay?" -- and
// it names both providers rather than whichever one happened to be wired
// first, which is what a Click-only message would imply.
function registerCheckoutHandlers(bot, { getLanguage, t, DEFAULT_LANG, safeAnswerCbQuery }) {
  bot.action("payments:noop", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "paymentsNotConfigured"));
  });
}

module.exports = { buildPaymentOptions, paymentRows, registerCheckoutHandlers, PROVIDERS, PROVIDER_LABELS };
