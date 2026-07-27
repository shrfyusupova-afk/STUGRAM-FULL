const { Markup } = require("telegraf");
const { getProfile, getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { createOrder, buildCheckoutUrl, VIP_CHAT_PRICE_SOM } = require("./click");
const { safeAnswerCbQuery } = require("./telegramSafety");

// Telegram invite links can be revoked/regenerated later -- if that ever
// happens, update this constant (or move it to an env var) and redeploy.
const VIP_CHAT_INVITE_LINK = "https://t.me/+p80FAqlT0c81Y2Uy";

function payButtonKeyboard(lang) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(lang, "vipPayButton"), "vip:pay:choose")]]);
}

function registerVipChatHandlers(bot) {
  const vipLabels = Object.values(STRINGS).map((dict) => dict.menu.vip);

  bot.hears(vipLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const profile = getProfile(ctx.from.id);
    const isFemale = profile?.gender === "female";
    const button = isFemale
      ? Markup.button.callback(t(lang, "vipJoinFreeButton"), "vip:join:free")
      : Markup.button.callback(t(lang, "vipPayButton"), "vip:pay:choose");
    await ctx.reply(t(lang, "vipIntro"), Markup.inlineKeyboard([[button]]));
  });

  // Re-checks gender server-side rather than trusting that only women ever
  // see this button -- a forged callback shouldn't grant free access.
  bot.action("vip:join:free", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    const profile = getProfile(ctx.from.id);
    if (profile?.gender !== "female") {
      await ctx.reply(t(lang, "vipIntro"), payButtonKeyboard(lang));
      return;
    }
    await ctx.reply(t(lang, "vipJoinMessage")(VIP_CHAT_INVITE_LINK));
  });

  // Click is the only payment provider wired into the codebase -- no
  // second option to choose between, so this goes straight to the
  // checkout button instead of showing a payment-method picker.
  bot.action("vip:pay:choose", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    const orderId = createOrder(ctx.from.id, { type: "vipchat" });
    const clickUrl = buildCheckoutUrl(orderId, VIP_CHAT_PRICE_SOM);

    const clickButton = clickUrl
      ? Markup.button.url(t(lang, "vipClickButton"), clickUrl)
      : Markup.button.callback(t(lang, "vipClickButton"), "vip:pay:click:noop");

    await ctx.reply(t(lang, "vipPayIntro"), Markup.inlineKeyboard([[clickButton]]));
  });

  bot.action("vip:pay:click:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "vipClickNotConfigured"));
  });
}

module.exports = { registerVipChatHandlers, VIP_CHAT_INVITE_LINK };
