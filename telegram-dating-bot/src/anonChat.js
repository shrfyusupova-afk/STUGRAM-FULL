const { Markup } = require("telegraf");
const { getProfile, getLanguage, hasAnonGenderFilter } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { createOrder, buildCheckoutUrl, ANON_GENDER_PRICE_SOM } = require("./click");
const { safeAnswerCbQuery } = require("./telegramSafety");

const CHAT_DURATION_MS = 3 * 60 * 1000;

// In-memory only -- both the waiting queue and active chats are inherently
// short-lived/real-time, so losing them on a restart just means a rejoin,
// not lost data (unlike likes/profiles/payments, which are persisted).
// waitingQueue: userId -> { gender, wants: "male"|"female"|"any", lang }
// activeChats: userId -> { partnerId, timer }
const waitingQueue = new Map();
const activeChats = new Map();

function anonSubmenuKeyboard(lang) {
  return Markup.keyboard([
    [t(lang, "anonGirlButton"), t(lang, "anonBoyButton")],
    [t(lang, "anonRandomButton")],
    [t(lang, "backButton")],
  ]).resize();
}

// Real, unweighted matching -- "wants" must be mutually satisfied both ways.
// No gender is ever favored over another here; "Random" (wants: "any") gets
// an honestly random pick among everyone currently compatible.
function findMatch(userId, gender, wants) {
  const candidates = [];
  for (const [otherId, entry] of waitingQueue) {
    if (otherId === userId) continue;
    const otherWantsOk = entry.wants === "any" || entry.wants === gender;
    const selfWantsOk = wants === "any" || wants === entry.gender;
    if (otherWantsOk && selfWantsOk) candidates.push(otherId);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function startChat(telegram, userAId, userBId) {
  const timer = setTimeout(() => endChatByTimeout(telegram, userAId), CHAT_DURATION_MS);
  activeChats.set(userAId, { partnerId: userBId, timer });
  activeChats.set(userBId, { partnerId: userAId, timer });
}

async function endChatByTimeout(telegram, userId) {
  const chat = activeChats.get(userId);
  if (!chat) return;
  const partnerId = chat.partnerId;
  activeChats.delete(userId);
  activeChats.delete(partnerId);

  const lang1 = getLanguage(userId) || DEFAULT_LANG;
  const lang2 = getLanguage(partnerId) || DEFAULT_LANG;
  try {
    await telegram.sendMessage(userId, t(lang1, "anonChatEnded"));
  } catch (err) {
    console.error("anon chat end notify failed:", err.message);
  }
  try {
    await telegram.sendMessage(partnerId, t(lang2, "anonChatEnded"));
  } catch (err) {
    console.error("anon chat end notify failed:", err.message);
  }
}

// Used by discover.js's shared "Orqaga" handler so leaving the anon chat
// screen from anywhere also cleans up any pending search or active chat --
// only the partner is notified (the person leaving already knows they left).
async function leaveAnonQueueOrChat(telegram, userId) {
  waitingQueue.delete(userId);
  const chat = activeChats.get(userId);
  if (!chat) return;
  const partnerId = chat.partnerId;
  clearTimeout(chat.timer);
  activeChats.delete(userId);
  activeChats.delete(partnerId);
  const lang = getLanguage(partnerId) || DEFAULT_LANG;
  try {
    await telegram.sendMessage(partnerId, t(lang, "anonPartnerLeft"));
  } catch (err) {
    console.error("anon partner-left notify failed:", err.message);
  }
}

async function attemptJoin(ctx, wants) {
  const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
  const me = getProfile(ctx.from.id);
  if (!me?.gender) return;
  const userId = ctx.from.id;

  if (activeChats.has(userId)) {
    await ctx.reply(t(lang, "anonAlreadyInChat"));
    return;
  }
  if (waitingQueue.has(userId)) {
    await ctx.reply(t(lang, "anonAlreadySearching"));
    return;
  }

  const partnerId = findMatch(userId, me.gender, wants);
  if (partnerId) {
    waitingQueue.delete(partnerId);
    startChat(ctx.telegram, userId, partnerId);
    const partnerLang = getLanguage(partnerId) || DEFAULT_LANG;
    await ctx.reply(t(lang, "anonMatched"));
    try {
      await ctx.telegram.sendMessage(partnerId, t(partnerLang, "anonMatched"));
    } catch (err) {
      console.error("anon match notify failed:", err.message);
    }
    return;
  }

  waitingQueue.set(userId, { gender: me.gender, wants, lang });
  await ctx.reply(t(lang, "anonSearching"));
}

async function showGenderPaywall(ctx, lang) {
  const orderId = createOrder(ctx.from.id, { type: "anongender" });
  const clickUrl = buildCheckoutUrl(orderId, ANON_GENDER_PRICE_SOM);
  const button = clickUrl
    ? Markup.button.url(t(lang, "anonPayButton"), clickUrl)
    : Markup.button.callback(t(lang, "anonPayButton"), "anon:pay:click:noop");
  await ctx.reply(t(lang, "anonGenderPaywallIntro"), Markup.inlineKeyboard([[button]]));
}

function registerAnonChatHandlers(bot) {
  const anonChatLabels = Object.values(STRINGS).map((dict) => dict.menu.anonChat);
  const girlLabels = Object.values(STRINGS).map((dict) => dict.anonGirlButton);
  const boyLabels = Object.values(STRINGS).map((dict) => dict.anonBoyButton);
  const randomLabels = Object.values(STRINGS).map((dict) => dict.anonRandomButton);

  // Registered before any other text handler so a message from someone
  // currently in an active anon chat is ALWAYS relayed, never accidentally
  // matched by an unrelated button handler (e.g. the partner typing "❤️").
  bot.on("text", async (ctx, next) => {
    const chat = activeChats.get(ctx.from.id);
    if (!chat) return next();
    try {
      await ctx.telegram.sendMessage(chat.partnerId, ctx.message.text);
    } catch (err) {
      console.error("anon chat relay failed:", err.message);
    }
  });

  bot.hears(anonChatLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    if (!me?.gender) return;
    await ctx.reply(t(lang, "anonChatIntro"), anonSubmenuKeyboard(lang));
  });

  bot.hears(girlLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    if (!hasAnonGenderFilter(ctx.from.id)) {
      await showGenderPaywall(ctx, lang);
      return;
    }
    await attemptJoin(ctx, "female");
  });

  bot.hears(boyLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    if (!hasAnonGenderFilter(ctx.from.id)) {
      await showGenderPaywall(ctx, lang);
      return;
    }
    await attemptJoin(ctx, "male");
  });

  // Always free, always genuinely random -- no gender is ever favored here.
  bot.hears(randomLabels, async (ctx) => {
    await attemptJoin(ctx, "any");
  });

  bot.action("anon:pay:click:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "anonNotConfigured"));
  });
}

module.exports = { registerAnonChatHandlers, leaveAnonQueueOrChat };
