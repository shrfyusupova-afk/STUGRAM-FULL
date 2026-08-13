const { Markup } = require("telegraf");
const { getProfile, getLanguage, hasAnonGenderFilter } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { ANON_GENDER_PRICE_SOM } = require("./orders");
const { buildPaymentOptions, paymentRows } = require("./checkout");
const { passesGate } = require("./channelGate");
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

// Minimum gap between one person's messages actually reaching their partner
// -- see the relay handler below for why this exists alongside the bot-wide
// flood guard. Real typed conversation is nowhere near this fast; it only
// bites a script.
const MIN_RELAY_GAP_MS = 400;
const lastRelayAt = new Map();

function canRelay(userId) {
  const now = Date.now();
  const last = lastRelayAt.get(userId) || 0;
  if (now - last < MIN_RELAY_GAP_MS) return false;
  lastRelayAt.set(userId, now);
  return true;
}

// Otherwise this map only ever grows -- every chat adds two entries that
// nothing removes, for the lifetime of the process.
function clearRelayPacing(userId, partnerId) {
  lastRelayAt.delete(userId);
  lastRelayAt.delete(partnerId);
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
  clearRelayPacing(userId, partnerId);

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
  clearRelayPacing(userId, partnerId);
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

// Whether this person can currently pick a gender, and until when -- shown on
// the anon-chat screen so the answer to "am I subscribed, and do both buttons
// work for me?" is visible without having to tap one and find out.
//
// Premium grants this filter too (that is what the paywall promises), and it
// carries its own separate expiry, so whichever of the two actually runs
// longer is the honest date to quote.
async function genderFilterStatus(userId, lang) {
  if (!(await hasAnonGenderFilter(userId))) return null;
  const profile = await getProfile(userId);
  const now = Date.now();
  const dates = [profile?.anonGenderUntil, profile?.premiumUntil]
    .map((iso) => (iso ? new Date(iso) : null))
    .filter((d) => d && d.getTime() > now);
  if (dates.length === 0) return null;
  const until = new Date(Math.max(...dates.map((d) => d.getTime())));
  return t(lang, "anonFilterActive")(until.toISOString().slice(0, 10));
}

async function showGenderPaywall(ctx, lang) {
  const { options, configured } = await buildPaymentOptions(ctx.from.id, {
    type: "anongender",
    amountSom: ANON_GENDER_PRICE_SOM,
    lang,
    t,
  });
  const rows = configured
    ? paymentRows(options)
    : [[Markup.button.callback(t(lang, "payButtonGeneric"), "payments:noop")]];
  await ctx.reply(t(lang, "anonGenderPaywallIntro"), Markup.inlineKeyboard(rows));
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
      clearRelayPacing(userId, partnerId);
      // Both sides get the same treatment: their keyboard back, plus the
      // option to report the person they were just talking to.
      await sendChatEnded(ctx.telegram, userId, partnerId, "anonChatEnded");
      await sendChatEnded(ctx.telegram, partnerId, userId, "anonPartnerLeft");
      return;
    }

    // A live, anonymous partner is the one place in this bot where flooding
    // means actually bombing a specific, real, non-consenting person with
    // messages -- everywhere else a flood only wastes our own resources. The
    // global flood guard in index.js catches scripted abuse eventually, but
    // its window is generous (tuned for the whole bot); this is a tighter,
    // relay-specific pace on top of it, so even a burst within that ceiling
    // can't hit the partner faster than someone genuinely typing would.
    // Dropped silently and without telling the sender -- replying "you're
    // going too fast" would itself be one more outgoing message per flood
    // attempt, and the sender finding out changes nothing they can act on
    // usefully mid-chat.
    if (!canRelay(userId)) return;

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
    // The status line rides along with the intro rather than as its own
    // message, so opening this screen answers "is my subscription live?" in
    // one place instead of leaving it to be discovered by tapping.
    const status = await genderFilterStatus(ctx.from.id, lang);
    const intro = status ? `${t(lang, "anonChatIntro")}\n\n${status}` : t(lang, "anonChatIntro");
    await ctx.reply(intro, { parse_mode: "HTML", ...anonSubmenuKeyboard(lang) });
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
    // Checked BEFORE the search starts, so nobody is put into the queue and
    // then interrupted -- and skipped entirely for anyone already subscribed.
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    if (!(await passesGate(ctx, lang, "anon"))) return;
    await attemptJoin(ctx, "any");
  });

}

// attemptJoin is exported so the channel gate can resume the search the
// moment somebody subscribes, instead of making them tap the button again.
module.exports = { registerAnonChatHandlers, leaveAnonQueueOrChat, anonSubmenuKeyboard, attemptJoin };
