// Builds the payment buttons shown on every paywall.
//
// One place, because "which providers can this person pay with" is a single
// question with a single answer, and five screens each deciding it for
// themselves is exactly how one of them ends up missing a provider after the
// next change. Every paywall in the app calls this.
const { Markup } = require("telegraf");
const { createOrder, getOrder } = require("./orders");
const clickProvider = require("./click");
const paymeProvider = require("./payme");

// How each provider is named to a user, for the places a label is needed
// outside a button (the QR caption). Not translated: these are brand names.
const PROVIDER_LABELS = { click: "Click", payme: "Payme" };

// Order matters only in that it is the order the buttons appear in.
//
// `sandbox` answers "is this provider pointed at its TEST environment right
// now". Payme's onboarding requires running against test.paycom.uz for a
// while before they switch the merchant on -- and a button leading there is
// worse than no button at all: it opens, it looks completely normal, and no
// real money can move through it. The person tries to pay, nothing arrives,
// and every screen involved reads as broken. A provider that cannot take real
// money simply contributes no button until it can.
const PROVIDERS = [
  { key: "click", label: "click", build: clickProvider.buildCheckoutUrl, sandbox: () => false },
  { key: "payme", label: "payme", build: paymeProvider.buildCheckoutUrl, sandbox: paymeProvider.isTestCheckout },
];

// Creates (or reuses) the order and returns one button per configured
// provider, plus the order id and the urls for anything else that needs them.
//
// The SAME order id goes to every provider: the person is buying one thing,
// and whichever checkout they actually complete settles that one order. A
// provider that is not configured simply contributes no button rather than a
// dead one.
async function buildPaymentOptions(userId, { type, targetId, amountSom, lang, t }) {
  // amountSom is passed on to createOrder as well as used for the checkout
  // URL. For every fixed-price product it is ignored there and the price
  // comes from the constants (see orders.js), so this changes nothing for
  // them; it is what lets the ForStatistic board, where the buyer names the
  // figure, store the amount the provider will actually be asked for. The
  // two MUST come from one value: a URL asking for one amount while the
  // ledger expects another is a payment the callback then rejects.
  const orderId = await createOrder(userId, { type, targetId, amountSom });

  const options = [];
  for (const provider of PROVIDERS) {
    if (provider.sandbox()) continue;
    const url = provider.build(orderId, amountSom);
    if (!url) continue;
    options.push({
      key: provider.key,
      url,
      button: Markup.button.url(t(lang, `payWith_${provider.label}`), url),
    });
  }

  const configured = options.length > 0;
  return {
    orderId,
    options,
    configured,
    // What a paywall actually puts on screen: a row per provider, then the
    // confirm button. Callers use this rather than assembling it themselves,
    // so no screen can end up with providers but no way to come back from
    // them -- see paymentNote() for why coming back has to be explicit.
    rows: configured ? [...paymentRows(options), [confirmButton(orderId, lang, t)]] : [],
    note: configured ? paymentNote(options, lang, t) : "",
  };
}

// The keyboard rows for a paywall: one button per provider, stacked, so each
// stays wide enough to read on a phone. Callers append their own extra rows
// (e.g. "use a free credit", "get Premium instead").
function paymentRows(options) {
  return options.map((option) => [option.button]);
}

// "I have paid".
//
// A provider button is a URL button: tapping it leaves Telegram for the
// bank's page, and Telegram reports nothing back to the bot -- not the tap,
// not the return. So the person comes back to a screen that looks exactly as
// it did before they paid, with no way to say what just happened. This is
// that way. It reads the ledger; it never takes the person's word for it.
function confirmButton(orderId, lang, t) {
  return Markup.button.callback(t(lang, "paymentDoneButton"), `payments:done:${orderId}`);
}

// Appended to every paywall's text. Same reason: the three steps have to be
// visible BEFORE the tap, because after the tap the person is on a different
// site and there is nothing left of ours to read.
//
// Step 1 names the providers actually on the screen rather than both of them
// always. A note that says "tap Click or Payme" above a single Click button
// sends somebody hunting for a button that is not there -- and the natural
// conclusion is that the screen is broken, not that we only take one card
// today.
function paymentNote(options, lang, t) {
  const names = options.map((option) => PROVIDER_LABELS[option.key] || option.key);
  // A person whose bank Click doesn't support used to have no way through
  // this screen at all -- the only button on it was the one that couldn't
  // take their money. Every paywall now says plainly that there is a human
  // to write to instead, right under the steps, not buried somewhere else.
  return `${t(lang, "paymentHowToNote")(names.join(t(lang, "paymentProviderJoin")))}\n\n${t(lang, "paymentAdminHelpNote")}`;
}

// Appends the note to a paywall body. One helper so every paywall separates
// it the same way, and so a screen without a configured provider (where the
// steps would be nonsense) simply gets its own text back.
function withPaymentNote(text, note) {
  return note ? `${text}\n\n${note}` : text;
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

  // "I have paid" -- answered from the ledger, never from the claim.
  //
  // The person tapping this genuinely believes they paid, and often they
  // have; the money just hasn't reached us yet. But telling someone their
  // payment went through when the ledger says pending would hand out a paid
  // feature for free and, worse, leave them certain they are owed nothing
  // when the charge later fails. So an unpaid order gets "not confirmed yet,
  // try again in a minute" -- which is the truth, and is also what someone
  // who paid 20 seconds ago needs to hear.
  bot.action(/^payments:done:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);

    let order = null;
    try {
      order = await getOrder(orderId);
    } catch (err) {
      console.error(`Could not read order ${orderId} for payment confirmation:`, err.message);
    }

    // Someone else's order, or an id that no longer exists. Both are answered
    // exactly like "not paid yet": there is nothing here to reveal, and an
    // order id is not a thing anyone should be able to probe for.
    if (!order || String(order.userId) !== String(ctx.from.id) || order.status !== "paid") {
      await ctx.reply(t(lang, "paymentPendingNotice"));
      return;
    }

    // Paid. For an unlock the person is waiting on one specific profile, so
    // hand them a direct way into it rather than a message that only says
    // "it worked" and leaves them to find it. The button re-checks access on
    // the other side (discover.js), so this is a shortcut, not a bypass.
    if (order.type === "unlock" && order.targetId) {
      await ctx.reply(t(lang, "unlockPaidOpenProfile"), {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback(t(lang, "unlockOpenProfileButton"), `unlock:view:${order.targetId}`)],
        ]),
      });
      return;
    }

    // Premium/VIP/anon already got their own congratulation when the payment
    // settled; this only confirms, so it doesn't repeat the whole thing.
    await ctx.reply(t(lang, "paymentConfirmedNotice"));
  });
}

module.exports = {
  buildPaymentOptions,
  paymentRows,
  withPaymentNote,
  confirmButton,
  registerCheckoutHandlers,
  PROVIDERS,
  PROVIDER_LABELS,
};
