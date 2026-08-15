const { Markup } = require("telegraf");
const { getProfile, getLanguage, hasVipChat, hasPremium } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { VIP_CHAT_PRICE_SOM } = require("./orders");
const { buildPaymentOptions, withPaymentNote } = require("./checkout");
const { safeAnswerCbQuery } = require("./telegramSafety");

// The fallback, used whenever the bot cannot mint a link of its own (no
// VIP_CHAT_ID, not an admin of the group, Telegram refusing). Shareable, and
// that is its weakness -- but a purchase that delivers nothing is worse, so
// this is what every failure path lands on.
//
// Telegram invite links can be revoked/regenerated later -- if that ever
// happens, update this constant (or move it to an env var) and redeploy.
const VIP_CHAT_INVITE_LINK = "https://t.me/+p80FAqlT0c81Y2Uy";

// Required lazily inside the functions that use it: vipInvite.js needs
// VIP_CHAT_INVITE_LINK from here for its fallback, so requiring it at the top
// would be a cycle.
function inviteLinkFor(telegram, userId, opts) {
  return require("./vipInvite").vipInviteLink(telegram, userId, opts);
}

// Two different questions, kept apart on purpose.
//
// hasVipChat is "was this person GIVEN VIP" -- a purchase or an admin gift,
// written down and permanent. This is "may they walk in today", which is a
// wider thing: Premium currently carries VIP access along with it.
//
// That bonus is deliberately temporary. The group is new, and a full room is
// worth more right now than the seat fee -- so Premium seats it for free
// while that is true. Once the group is big enough that a seat is worth
// paying for on its own, this line goes and Premium stops including it. It is
// one line, in one place, precisely so removing it later is one line.
async function canUseVipChat(userId) {
  return (await hasVipChat(userId)) || (await hasPremium(userId));
}

function payButtonKeyboard(lang) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(lang, "vipPayButton"), "vip:pay:choose")]]);
}

// The price is passed in rather than typed into the text, so it can never go
// stale against the constant -- and the intro is HTML, for the bold emphasis
// on "this is the lowest price it will ever be".
async function sendVipIntro(ctx, lang, keyboard) {
  await ctx.reply(t(lang, "vipIntro")(VIP_CHAT_PRICE_SOM.toLocaleString("uz-UZ")), {
    parse_mode: "HTML",
    ...keyboard,
  });
}

function registerVipChatHandlers(bot) {
  const vipLabels = Object.values(STRINGS).map((dict) => dict.menu.vip);

  bot.hears(vipLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    // Already entitled -- bought it, was gifted it, or holds Premium? Hand the
    // link straight back instead of asking for money a second time. This is
    // also the recovery path if the original "here's your link" message failed
    // to send right after payment.
    if (await canUseVipChat(ctx.from.id)) {
      // A fresh single-use link each time they ask. The previous one may well
      // have been used already, and a spent link would read as the purchase
      // having been taken away.
      const link = await inviteLinkFor(ctx.telegram, ctx.from.id, { paid: true });
      // Somebody walking in on Premium is told WHY it is free and that it
      // will not always be -- a perk nobody knows they have is not a perk,
      // and one that quietly disappears later reads as something taken away.
      const boughtOutright = await hasVipChat(ctx.from.id);
      await ctx.reply(
        boughtOutright ? t(lang, "vipJoinMessage")(link) : t(lang, "vipPremiumBonusMessage")(link),
        { parse_mode: "HTML" }
      );
      return;
    }
    const profile = await getProfile(ctx.from.id);
    const isFemale = profile?.gender === "female";
    const button = isFemale
      ? Markup.button.callback(t(lang, "vipJoinFreeButton"), "vip:join:free")
      : Markup.button.callback(t(lang, "vipPayButton"), "vip:pay:choose");
    await sendVipIntro(ctx, lang, Markup.inlineKeyboard([[button]]));
  });

  // Re-checks gender server-side rather than trusting that only women ever
  // see this button -- a forged callback shouldn't grant free access.
  bot.action("vip:join:free", async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    const profile = await getProfile(ctx.from.id);
    if (profile?.gender !== "female") {
      await sendVipIntro(ctx, lang, payButtonKeyboard(lang));
      return;
    }
    // Free, but not automatic: this link raises a join request that a group
    // admin approves, rather than admitting anybody who taps it.
    const link = await inviteLinkFor(ctx.telegram, ctx.from.id, { paid: false });
    await ctx.reply(t(lang, "vipJoinRequestMessage")(link));
  });

  // One button per configured provider -- the person picks how to pay, and
  // whichever they choose settles the same order.
  bot.action("vip:pay:choose", async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    const payment = await buildPaymentOptions(ctx.from.id, {
      type: "vipchat",
      amountSom: VIP_CHAT_PRICE_SOM,
      lang,
      t,
    });

    const rows = payment.configured
      ? payment.rows
      : [[Markup.button.callback(t(lang, "payButtonGeneric"), "payments:noop")]];

    await ctx.reply(withPaymentNote(t(lang, "vipPayIntro"), payment.note), Markup.inlineKeyboard(rows));
  });

}

module.exports = { registerVipChatHandlers, canUseVipChat, VIP_CHAT_INVITE_LINK };
