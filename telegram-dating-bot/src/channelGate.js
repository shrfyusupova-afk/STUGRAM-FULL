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

// The gate can require SEVERAL channels at once, so CHANNEL_USERNAME holds a
// list: "foroneforever, forJahongir". Comma, semicolon, space or newline
// separated -- whatever somebody happens to paste into a Render environment
// field. Every entry goes through normaliseUsername, so a mix of "@name",
// "name" and full t.me URLs in one line is fine.
//
// Anything that does not parse is dropped rather than turned into a channel
// nobody can join, and duplicates collapse -- listing the same channel twice
// must not put two identical buttons on the gate.
function parseChannels(raw) {
  const seen = new Set();
  const channels = [];
  for (const part of String(raw || "").split(/[\s,;]+/)) {
    const username = normaliseUsername(part);
    if (!username) continue;
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // getChatMember wants "@name" for a public channel.
    channels.push({ username, url: `https://t.me/${username}`, chatId: `@${username}` });
  }
  return channels;
}

const CHANNELS = parseChannels(process.env.CHANNEL_USERNAME || "foroneforever, forJahongir");

// Kept for the callers that only ever wanted "the channel" -- they now get the
// first one. Everything that can show all of them uses CHANNELS instead.
const CHANNEL_USERNAME = CHANNELS[0]?.username || null;
const CHANNEL_URL = CHANNELS[0]?.url || null;

const channelList = (channels = CHANNELS) => channels.map((c) => `@${c.username}`).join(", ");

function isEnabled() {
  return CHANNELS.length > 0;
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
// The entry holds WHICH channels are still missing, not just a yes/no: the
// gate has to know what to put on the screen, and somebody who has joined one
// of two must not be asked for both again.
const cache = new Map(); // userId -> { missing: [channel], expiresAt }

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

// One channel. `answered` is false when Telegram could not tell us -- which
// counts as joined (rule 1), but must never be written to the cache; see
// evaluate() below.
async function checkChannel(telegram, channel, userId) {
  try {
    const member = await telegram.getChatMember(channel.chatId, userId);
    // A call that succeeds but does not come back as a recognisable member
    // object tells us nothing -- and "we cannot tell" must resolve the same
    // way an outright failure does, or an unexpected API shape would silently
    // lock every user out of the bot.
    if (typeof member?.status !== "string") {
      console.warn(`Channel check returned no status for ${userId} in ${channel.chatId} (letting them through).`);
      return { joined: true, answered: false };
    }
    return { joined: MEMBER_STATUSES.has(member.status), answered: true };
  } catch (err) {
    // "chat not found" / "member list is inaccessible" almost always means the
    // bot was never made an admin of the channel. Say so once per occurrence
    // in the log, then let the person through.
    console.warn(`Channel check failed for ${userId} in ${channel.chatId} (letting them through):`, err.message);
    return { joined: true, answered: false };
  }
}

// Which of the required channels this person still has to join, or [] when
// they are through. EVERY channel is required, so one missing subscription is
// enough to hold somebody at the gate.
//
// Checked in parallel: this sits on the swipe path, and a sequential loop
// would cost one Telegram round trip per channel on every uncached check.
async function evaluate(telegram, userId, { useCache = true } = {}) {
  if (!isEnabled()) return [];

  const cached = cache.get(userId);
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.missing;

  const results = await Promise.all(CHANNELS.map((c) => checkChannel(telegram, c, userId)));
  const missing = CHANNELS.filter((_, i) => !results[i].joined);

  // A single unanswerable channel makes the whole result provisional. It is
  // treated as joined so nobody is locked out, but caching that would keep the
  // gate open for a full hour after the misconfiguration is fixed -- so it is
  // not cached at all, and the very next check picks up the repair by itself.
  // (This is the self-healing the probe's comment below relies on.)
  if (results.every((r) => r.answered)) {
    cache.set(userId, {
      missing,
      expiresAt: Date.now() + (missing.length === 0 ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    });
  }
  return missing;
}

// Returns true when the person is in EVERY required channel, and --
// deliberately -- also true whenever the question cannot be answered.
async function isSubscribed(telegram, userId, options) {
  return (await evaluate(telegram, userId, options)).length === 0;
}

// Someone who just subscribed should not wait out the negative TTL.
function forget(userId) {
  cache.delete(userId);
}

// --- is the gate actually working? -------------------------------------------
//
// One configuration mistake silently disables everything in this file:
// getChatMember on a channel only answers for a bot that is an ADMIN of that
// channel. Without that, every check throws, rule 1 lets everybody through,
// and the gate looks exactly as if it had never been installed -- no error
// screen, no failed message, nothing a person using the bot would report.
//
// So it gets probed explicitly at startup and reported on /health, because
// "the feature is off" is otherwise indistinguishable from "the feature is on
// and everybody happens to be subscribed".
let gateStatus = "unknown (not probed yet)";

async function probeChannel(telegram) {
  if (!isEnabled()) {
    gateStatus = "disabled (no CHANNEL_USERNAME)";
    return gateStatus;
  }

  let me;
  try {
    me = await telegram.getMe();
  } catch (err) {
    gateStatus =
      `INACTIVE -- cannot identify the bot (${err.message}), so no channel can be ` +
      `probed and EVERYONE is being let through.`;
    report();
    return gateStatus;
  }

  // Each channel is admin-checked on its own: with several of them, one
  // misconfigured channel must be named, not hidden behind an overall "broken".
  const problems = [];
  const working = [];
  for (const channel of CHANNELS) {
    try {
      const member = await telegram.getChatMember(channel.chatId, me.id);
      const status = member?.status;
      if (status === "administrator" || status === "creator") working.push(channel);
      else problems.push(`@${channel.username}: the bot is "${status}", not an admin`);
    } catch (err) {
      problems.push(`@${channel.username}: cannot be read (${err.message})`);
    }
  }

  if (problems.length === 0) {
    gateStatus = `active (${channelList()})`;
  } else {
    // Precise about the blast radius: with one channel broken out of two,
    // people still have to join the other one -- saying "EVERYONE is being let
    // through" there would send somebody hunting for a fault that is not there.
    const scope =
      working.length === 0
        ? "EVERYONE is being let through"
        : `those are NOT enforced (${channelList(working)} still is)`;
    gateStatus =
      `INACTIVE -- ${problems.join("; ")}, so ${scope}. ` +
      `Fix: add the bot as an administrator of the channel.`;
  }

  report();
  return gateStatus;
}

// Only on a change. Re-probing on a timer would otherwise print the same line
// every quarter of an hour forever, which is how a log stops being read -- and
// this is a line that matters on the day it changes.
//
// A function declaration so the early return above (getMe failed, nothing left
// to probe) can reach it before it is defined here.
function report() {
  if (gateStatus === previousStatus) return;
  if (gateStatus.startsWith("INACTIVE")) console.warn(`Channel gate: ${gateStatus}`);
  else console.log(`Channel gate: ${gateStatus}`);
  previousStatus = gateStatus;
}

// Re-probed on a timer, not just at boot.
//
// Making the bot a channel admin is done in Telegram, not here, so the fix
// for an INACTIVE gate happens entirely outside this process -- and with a
// boot-only probe the only way to see that it worked was to restart the
// service. That is a redeploy to confirm a two-tap change, which is exactly
// the kind of friction that leaves a misconfiguration in place for weeks.
//
// The gate ITSELF already self-heals: a failed membership check is never
// cached, so the first check after the bot becomes an admin succeeds. Only
// the reported status was stale, and now it is not.
const PROBE_INTERVAL_MS = 15 * 60 * 1000;
let previousStatus = null;

function startChannelProbe(telegram, intervalMs = PROBE_INTERVAL_MS) {
  const run = () => probeChannel(telegram).catch((err) => console.error("channel gate probe failed:", err.message));
  run();
  // unref: a diagnostic timer must never be the reason the process stays up.
  return setInterval(run, intervalMs).unref();
}

function channelGateStatus() {
  return gateStatus;
}

// --- the gate screen ---------------------------------------------------------

// One join button per channel. With a single channel the label is the plain
// "subscribe" text it has always been; with several, each button carries its
// own @name -- two identical buttons pointing at different channels is a
// screen nobody can act on.
//
// Exported because the post-registration invitation in profileWizard.js shows
// the same set of channels, and two lists that can disagree is how one of them
// ends up quietly missing a channel.
function joinButtons(lang, channels = CHANNELS) {
  const many = CHANNELS.length > 1;
  return channels.map((channel) => [
    Markup.button.url(
      many ? t(lang, "channelJoinButtonNamed")(channel.username) : t(lang, "channelJoinButton"),
      channel.url
    ),
  ]);
}

// `action` is carried in the callback data so the "I subscribed" button knows
// what to resume: continue swiping, start an anonymous chat, and so on.
function gateKeyboard(lang, action, channels) {
  return Markup.inlineKeyboard([
    ...joinButtons(lang, channels),
    [Markup.button.callback(t(lang, "channelCheckButton"), `gate:check:${action}`)],
  ]);
}

async function showGate(ctx, lang, action, channels = CHANNELS) {
  await ctx.reply(t(lang, CHANNELS.length > 1 ? "channelGateTextMany" : "channelGateText"), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...gateKeyboard(lang, action, channels),
  });
}

// The one call sites make. Returns true when the caller should carry on, and
// false when the gate has been shown instead -- in which case the caller must
// do nothing more, because the resume handler will run its work later.
//
// Only the channels still MISSING go on the screen: asking somebody who has
// already joined one of two to join it again reads as the bot not noticing.
async function passesGate(ctx, lang, action) {
  if (!isEnabled()) return true;
  const missing = await evaluate(ctx.telegram, ctx.from.id);
  if (missing.length === 0) return true;
  await showGate(ctx, lang, action, missing);
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
    const missing = await evaluate(ctx.telegram, ctx.from.id, { useCache: false });

    if (missing.length > 0) {
      // With more than one channel, "subscription not found" on its own leaves
      // somebody who joined one of two with no idea which is still missing.
      const toast =
        CHANNELS.length > 1
          ? `${t(lang, "channelNotJoinedToast")}\n\n${channelList(missing)}`
          : t(lang, "channelNotJoinedToast");
      await ctx.answerCbQuery(toast, { show_alert: true }).catch(() => {});
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
  probeChannel,
  startChannelProbe,
  channelGateStatus,
  // Every required channel, in the order they were configured.
  CHANNELS,
  joinButtons,
  // The first channel, for the callers that only ever wanted "the channel".
  CHANNEL_URL,
  CHANNEL_USERNAME,
  __test: { normaliseUsername, parseChannels, cache, sweepCache },
};
