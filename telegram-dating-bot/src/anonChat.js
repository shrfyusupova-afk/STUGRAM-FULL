const { Markup } = require("telegraf");
const { getProfile, getLanguage, hasAnonGenderFilter } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { createOrder, buildCheckoutUrl, ANON_GENDER_PRICE_SOM } = require("./click");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { mainMenuKeyboard } = require("./menu");

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

// The ONLY button shown once actually matched -- swaps out the girl/boy/
// random/back submenu for the duration of the live chat.
function anonChatKeyboard(lang) {
  return Markup.keyboard([[t(lang, "anonStopButton")]]).resize();
}

// Offered once a chat is over rather than during it: the live chat keyboard is
// deliberately just the stop button, so the way to report a partner is on the
// message that tells you the chat ended. Inline, because it has to carry which
// partner it was -- by then they're gone from activeChats.
function anonReportKeyboard(lang, partnerId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, "reportPartnerButton"), `report:anon:${partnerId}`)],
  ]);
}

// Real, unweighted matching -- "wants" must be mutually satisfied both ways.
// No gender is ever favored over another here; "Random" (wants: "any") gets
// an honestly random pick among everyone currently compatible.
// Nobody waits usefully for longer than this. Someone who tapped "search" and
// then closed Telegram used to sit in the queue indefinitely and would later
// be matched with a real person who then talked to a ghost -- the worst
// possible first impression of the feature.
const QUEUE_TTL_MS = 10 * 60 * 1000;

function dropExpiredWaiters() {
  const now = Date.now();
  for (const [userId, entry] of waitingQueue) {
    if (now - entry.joinedAt > QUEUE_TTL_MS) waitingQueue.delete(userId);
  }
}

function findMatch(userId, gender, wants) {
  // Swept on every attempt rather than on a timer: matching is the only
  // moment a stale entry can actually do harm.
  dropExpiredWaiters();
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

// Tells someone their chat is over and offers to report who they were talking
// to. Two messages rather than one because the first has to restore the main
// reply keyboard and the second carries an inline button -- Telegram allows
// only one keyboard per message.
async function sendChatEnded(telegram, userId, partnerId, textKey) {
  const lang = (await getLanguage(userId)) || DEFAULT_LANG;
  try {
    await telegram.sendMessage(userId, t(lang, textKey), mainMenuKeyboard(lang));
    await telegram.sendMessage(userId, t(lang, "anonReportOffer"), anonReportKeyboard(lang, partnerId));
  } catch (err) {
    console.error("anon chat end notify failed:", err.message);
  }
}

async function endChatByTimeout(telegram, userId) {
  const chat = activeChats.get(userId);
  if (!chat) return;
  const partnerId = chat.partnerId;
  activeChats.delete(userId);
  activeChats.delete(partnerId);

  await sendChatEnded(telegram, userId, partnerId, "anonChatEnded");
  await sendChatEnded(telegram, partnerId, userId, "anonChatEnded");
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
  await sendChatEnded(telegram, partnerId, userId, "anonPartnerLeft");
}

async function attemptJoin(ctx, wants) {
  const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
  const me = await getProfile(ctx.from.id);
  if (!me?.gender) {
    await ctx.reply(t(lang, "noProfileYet"));
    return;
  }
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
    const partnerLang = await getLanguage(partnerId) || DEFAULT_LANG;
    await ctx.reply(t(lang, "anonMatched"), anonChatKeyboard(lang));
    try {
      await ctx.telegram.sendMessage(partnerId, t(partnerLang, "anonMatched"), anonChatKeyboard(partnerLang));
    } catch (err) {
      console.error("anon match notify failed:", err.message);
    }
    return;
  }

  waitingQueue.set(userId, { gender: me.gender, wants, lang, joinedAt: Date.now() });
  await ctx.reply(t(lang, "anonSearching"));
}

async function showGenderPaywall(ctx, lang) {
  const orderId = await createOrder(ctx.from.id, { type: "anongender" });
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
  const stopLabels = Object.values(STRINGS).map((dict) => dict.anonStopButton);

  // Registered before any other text handler so a message from someone
  // currently in an active anon chat is ALWAYS caught here first, never
  // accidentally matched by an unrelated button handler (e.g. the partner
  // typing "❤️"). The stop-button check has to live INSIDE this same
  // handler (not a separate bot.hears registered later) -- otherwise this
  // relay would intercept and forward the stop button's own text as a
  // regular chat message before a later handler ever saw it.
  bot.on("text", async (ctx, next) => {
    const userId = ctx.from.id;
    const chat = activeChats.get(userId);
    if (!chat) return next();

    if (stopLabels.includes(ctx.message.text)) {
      const partnerId = chat.partnerId;
      clearTimeout(chat.timer);
      activeChats.delete(userId);
      activeChats.delete(partnerId);
      // Both sides get the same treatment: their keyboard back, plus the
      // option to report the person they were just talking to.
      await sendChatEnded(ctx.telegram, userId, partnerId, "anonChatEnded");
      await sendChatEnded(ctx.telegram, partnerId, userId, "anonPartnerLeft");
      return;
    }

    try {
      await ctx.telegram.sendMessage(chat.partnerId, ctx.message.text);
    } catch (err) {
      console.error("anon chat relay failed:", err.message);
    }
  });

  bot.hears(anonChatLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    if (!me?.gender) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    await ctx.reply(t(lang, "anonChatIntro"), anonSubmenuKeyboard(lang));
  });

  bot.hears(girlLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    if (!(await hasAnonGenderFilter(ctx.from.id))) {
      await showGenderPaywall(ctx, lang);
      return;
    }
    await attemptJoin(ctx, "female");
  });

  bot.hears(boyLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    if (!(await hasAnonGenderFilter(ctx.from.id))) {
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
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "anonNotConfigured"));
  });
}

module.exports = { registerAnonChatHandlers, leaveAnonQueueOrChat };
