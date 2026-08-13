// "Subscribe to our channel first" gate.
//
// Three rules shape everything here:
//
//   1. NEVER block on failure. If the membership check cannot be answered --
//      the bot is not an admin of the channel, Telegram is down, the channel
//      was renamed -- the person is let straight through. A gate that fails
//      closed would take the entire product offline over a configuration
//      mistake nobody would notice until users complained.
//
//   2. Already subscribed means invisible. Somebody who joined must never
//      see this again, so a positive result is cached and the gate simply
//      does not render.
//
//   3. Not configured means it does not exist. With no CHANNEL_USERNAME the
//      bot behaves exactly as it did before this file was added.
const { getLanguage } = require("./db");
const { t, DEFAULT_LANG } = require("./i18n");
const { Markup } = require("telegraf");

// Accepts "@name", "name", or a full t.me URL -- whatever gets pasted into
// the environment variable.
function normaliseUsername(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const fromUrl = trimmed.match(/^https?:\/\/t\.me\/([A-Za-z0-9_]+)/i);
  const name = (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, "");
  return /^[A-Za-z0-9_]{4,}$/.test(name) ? name : null;
}

const CHANNEL_USERNAME = normaliseUsername(process.env.CHANNEL_USERNAME || "foroneforever");
const CHANNEL_URL = CHANNEL_USERNAME ? `https://t.me/${CHANNEL_USERNAME}` : null;
// getChatMember wants "@name" for a public channel.
const CHANNEL_CHAT_ID = CHANNEL_USERNAME ? `@${CHANNEL_USERNAME}` : null;

function isEnabled() {
  return Boolean(CHANNEL_CHAT_ID);
}

// --- membership, cached ------------------------------------------------------
//
// Without a cache this would be one Telegram API call per swipe, on the
// hottest path in the app. A positive answer is held for a while; a negative
// one only briefly, because somebody who just tapped "subscribe" is about to
// come back and must not be told "you are still not subscribed" from a stale
// entry.
const POSITIVE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 5 * 1000;
const cache = new Map(); // userId -> { subscribed, expiresAt }

// One entry per person who ever swiped, and nothing removes them on its own --
// the same unbounded-growth shape already fixed elsewhere in this codebase.
const SWEEP_MS = 30 * 60 * 1000;
function sweepCache(now = Date.now()) {
  let removed = 0;
  for (const [userId, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(userId);
      removed++;
    }
  }
  return removed;
}
setInterval(sweepCache, SWEEP_MS).unref();

const MEMBER_STATUSES = new Set(["member", "administrator", "creator"]);

// Returns true when the person is in the channel, and -- deliberately -- also
// true whenever the question cannot be answered. See rule 1 above.
async function isSubscribed(telegram, userId, { useCache = true } = {}) {
  if (!CHANNEL_CHAT_ID) return true;

  const cached = cache.get(userId);
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.subscribed;

  let subscribed;
  try {
    const member = await telegram.getChatMember(CHANNEL_CHAT_ID, userId);
    // A call that succeeds but does not come back as a recognisable member
    // object tells us nothing -- and "we cannot tell" must resolve the same
    // way an outright failure does, or an unexpected API shape would silently
    // lock every user out of the bot.
    if (typeof member?.status !== "string") {
      console.warn(`Channel check returned no status for ${userId} (letting them through).`);
      return true;
    }
    subscribed = MEMBER_STATUSES.has(member.status);
  } catch (err) {
    // "chat not found" / "member list is inaccessible" almost always means the
    // bot was never made an admin of the channel. Say so once per occurrence
    // in the log, then let the person through.
    console.warn(`Channel check failed for ${userId} (letting them through):`, err.message);
    return true;
  }

  cache.set(userId, {
    subscribed,
    expiresAt: Date.now() + (subscribed ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  });
  return subscribed;
}

// Someone who just subscribed should not wait out the negative TTL.
function forget(userId) {
  cache.delete(userId);
}

// --- the gate screen ---------------------------------------------------------

// `action` is carried in the callback data so the "I subscribed" button knows
// what to resume: continue swiping, start an anonymous chat, and so on.
function gateKeyboard(lang, action) {
  return Markup.inlineKeyboard([
    [Markup.button.url(t(lang, "channelJoinButton"), CHANNEL_URL)],
    [Markup.button.callback(t(lang, "channelCheckButton"), `gate:check:${action}`)],
  ]);
}

async function showGate(ctx, lang, action) {
  await ctx.reply(t(lang, "channelGateText"), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...gateKeyboard(lang, action),
  });
}

// The one call sites make. Returns true when the caller should carry on, and
// false when the gate has been shown instead -- in which case the caller must
// do nothing more, because the resume handler will run its work later.
async function passesGate(ctx, lang, action) {
  if (!isEnabled()) return true;
  if (await isSubscribed(ctx.telegram, ctx.from.id)) return true;
  await showGate(ctx, lang, action);
  return false;
}

// Wires up the "✅ Obunani tekshirish" button. `resumers` maps an action name
// to what should happen once the person really has subscribed.
function registerChannelGate(bot, resumers = {}) {
  bot.action(/^gate:check:(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;

    // Bypass the cache: they have just been to the channel, so the few
    // seconds an old "no" would otherwise linger are exactly the seconds
    // that matter.
    forget(ctx.from.id);
    const subscribed = await isSubscribed(ctx.telegram, ctx.from.id, { useCache: false });

    if (!subscribed) {
      await ctx.answerCbQuery(t(lang, "channelNotJoinedToast"), { show_alert: true }).catch(() => {});
      return;
    }

    await ctx.answerCbQuery(t(lang, "channelJoinedToast")).catch(() => {});
    // The gate has served its purpose; leaving it on screen invites a second
    // tap that does nothing.
    await ctx.deleteMessage().catch(() => {});

    const resume = resumers[action];
    if (resume) await resume(ctx, lang);
  });
}

module.exports = {
  registerChannelGate,
  passesGate,
  isSubscribed,
  isEnabled,
  forget,
  CHANNEL_URL,
  CHANNEL_USERNAME,
  __test: { normaliseUsername, cache, sweepCache },
};
