const { Markup } = require("telegraf");
const { getProfile, getAllProfiles, getLanguage, recordLike } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { getUsername } = require("./botInfo");
const { sendMainMenu } = require("./menu");

const LIKE = "❤️";
const DISLIKE = "👎";

// In-memory only: which candidate is currently shown to each user, and which
// candidates they've already been shown this run (avoids immediate repeats
// until the pool is exhausted, then cycles again). Resets on restart --
// acceptable for this early version of the discovery feature.
const discoverState = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function oppositeGender(gender) {
  return gender === "male" ? "female" : "male";
}

function pickCandidate(userId, myGender) {
  const all = getAllProfiles();
  const wanted = oppositeGender(myGender);
  const pool = Object.entries(all).filter(
    ([id, p]) => id !== String(userId) && p.gender === wanted && p.mediaFileId && p.phone
  );
  if (pool.length === 0) return null;

  let state = discoverState.get(userId);
  if (!state) {
    state = { currentId: null, shown: new Set() };
    discoverState.set(userId, state);
  }

  let remaining = pool.filter(([id]) => !state.shown.has(id));
  if (remaining.length === 0) {
    state.shown.clear();
    remaining = pool;
  }

  const [id, profile] = remaining[Math.floor(Math.random() * remaining.length)];
  state.currentId = id;
  state.shown.add(id);
  return { id, profile };
}

function discoverKeyboard(lang) {
  return Markup.keyboard([[LIKE, DISLIKE], [t(lang, "backButton")]]).resize();
}

async function sendCandidate(ctx, lang, candidateId, profile) {
  const username = getUsername();
  const unlockUrl = username ? `https://t.me/${username}?start=unlock_${candidateId}` : null;
  const unlockLabel = escapeHtml(t(lang, "unlockLinkText"));
  const unlockLine = unlockUrl ? `🔐 <a href="${unlockUrl}">${unlockLabel}</a>` : `🔐 ${unlockLabel}`;

  const caption =
    `👤 <b>${escapeHtml(profile.name)}</b>, ${profile.age}\n` +
    `📍 ${escapeHtml(profile.location)}\n\n` +
    `${escapeHtml(profile.bio)}\n\n\n` +
    unlockLine;

  const extra = { caption, parse_mode: "HTML", ...discoverKeyboard(lang) };

  if (profile.mediaType === "video") {
    await ctx.replyWithVideo(profile.mediaFileId, extra);
  } else {
    await ctx.replyWithPhoto(profile.mediaFileId, extra);
  }
}

async function showNextCandidate(ctx, lang, myGender) {
  if (!myGender) return;
  const candidate = pickCandidate(ctx.from.id, myGender);
  if (!candidate) {
    await ctx.reply(t(lang, "discoverNoCandidates"), discoverKeyboard(lang));
    return;
  }
  await sendCandidate(ctx, lang, candidate.id, candidate.profile);
}

function registerDiscoverHandlers(bot) {
  const discoverLabels = Object.values(STRINGS).map((dict) => dict.menu.discover);
  const backLabels = Object.values(STRINGS).map((dict) => dict.backButton);

  bot.hears(discoverLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    if (!me?.gender) return;
    await showNextCandidate(ctx, lang, me.gender);
  });

  bot.hears(LIKE, async (ctx) => {
    const state = discoverState.get(ctx.from.id);
    if (state?.currentId) {
      recordLike(ctx.from.id, state.currentId);
    }
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender);
  });

  bot.hears(DISLIKE, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender);
  });

  // Scoped to whichever screen actually shows this label: while the profile
  // wizard scene is active, its own internal handler intercepts it first
  // (Telegraf runs scene middleware before this), so this only fires when
  // "Back" is tapped from the discover keyboard.
  bot.hears(backLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    discoverState.delete(ctx.from.id);
    if (me) {
      await sendMainMenu(ctx, me, lang);
    }
  });

  bot.action("unlock:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.answerCbQuery();
    await ctx.reply(t(lang, "unlockPlaceholder"));
  });
}

async function handleUnlockDeepLink(ctx, lang) {
  await ctx.reply(
    t(lang, "unlockPlaceholder"),
    Markup.inlineKeyboard([[Markup.button.callback(t(lang, "unlockButton"), "unlock:noop")]])
  );
}

module.exports = { registerDiscoverHandlers, handleUnlockDeepLink };
