const { Markup } = require("telegraf");
const { getProfile, getAllProfiles, getLanguage, recordLike, hasLiked, hasUnlocked } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { getUsername } = require("./botInfo");
const { sendMainMenu } = require("./menu");
const { createOrder, buildCheckoutUrl, UNLOCK_PRICE_SOM } = require("./click");

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
    ([id, p]) => id !== String(userId) && p.gender === wanted && p.mediaFileId && p.phone && p.active !== false
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

// contactPhone is set once the viewer has actual access to this candidate
// (paid unlock or mutual like) -- it replaces the paywall line with the
// candidate's verified phone number, regardless of includeUnlock.
function buildProfileCaption(lang, candidateId, profile, { includeUnlock = true, contactPhone } = {}) {
  const base =
    `👤 <b>${escapeHtml(profile.name)}</b>, ${profile.age}\n` +
    `📍 ${escapeHtml(profile.location)}\n\n` +
    `${escapeHtml(profile.bio)}`;

  if (contactPhone) {
    return `${base}\n\n📞 ${escapeHtml(contactPhone)}`;
  }

  if (!includeUnlock) return base;

  const username = getUsername();
  const unlockUrl = username ? `https://t.me/${username}?start=unlock_${candidateId}` : null;
  const unlockLabel = escapeHtml(t(lang, "unlockLinkText")(UNLOCK_PRICE_SOM.toLocaleString("uz-UZ")));
  const unlockLine = unlockUrl ? `🔐 <a href="${unlockUrl}">${unlockLabel}</a>` : `🔐 ${unlockLabel}`;

  return `${base}\n\n\n${unlockLine}`;
}

// keyboardExtra is optional -- omit it (as the "who liked me" list and the
// self-view do) to send the card without touching whatever keyboard is
// currently docked. captionOptions is passed straight through to
// buildProfileCaption (e.g. { includeUnlock: false } for viewing your own
// profile, where "buy access to this chat" makes no sense).
async function sendCandidate(ctx, lang, candidateId, profile, keyboardExtra, captionOptions) {
  const caption = buildProfileCaption(lang, candidateId, profile, captionOptions);
  const extra = { caption, parse_mode: "HTML", ...(keyboardExtra || {}) };

  if (profile.mediaType === "video") {
    await ctx.replyWithVideo(profile.mediaFileId, extra);
  } else {
    await ctx.replyWithPhoto(profile.mediaFileId, extra);
  }
}

// True once the viewer can see this candidate's contact for free: either they
// paid for a one-time unlock, or both sides have liked each other.
function canViewProfile(viewerId, candidateId) {
  return hasUnlocked(viewerId, candidateId) || (hasLiked(viewerId, candidateId) && hasLiked(candidateId, viewerId));
}

function viewProfileKeyboard(lang, candidateId) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(lang, "viewProfileButton"), `unlock:view:${candidateId}`)]]);
}

async function revealProfile(ctx, lang, candidateId) {
  const candidate = getProfile(candidateId);
  if (!candidate) {
    await ctx.reply(t(lang, "unlockSuccessNoContact"));
    return;
  }
  await sendCandidate(ctx, lang, candidateId, candidate, undefined, { includeUnlock: false, contactPhone: candidate.phone });
}

async function showNextCandidate(ctx, lang, myGender) {
  if (!myGender) return;
  const candidate = pickCandidate(ctx.from.id, myGender);
  if (!candidate) {
    await ctx.reply(t(lang, "discoverNoCandidates"), discoverKeyboard(lang));
    return;
  }
  await sendCandidate(ctx, lang, candidate.id, candidate.profile, discoverKeyboard(lang));
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
    await ctx.reply(t(lang, "unlockNotConfigured"));
  });

  // Fired by the "👁 Profilni ko'rish" button shown either after a successful
  // Click payment or after a mutual like -- re-checks access before revealing
  // anything, since a forwarded/stale button could otherwise leak it.
  bot.action(/^unlock:view:(.+)$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.answerCbQuery();
    if (!canViewProfile(ctx.from.id, candidateId)) {
      await handleUnlockDeepLink(ctx, lang, candidateId);
      return;
    }
    await revealProfile(ctx, lang, candidateId);
  });
}

// Reached via the "🔐 ... (7 900 so'm)" link inside a candidate's card,
// which deep-links back into the bot as /start unlock_<candidateId>. If the
// viewer already has access (paid before, or a mutual like happened since),
// this skips the paywall entirely and shows the profile straight away.
async function handleUnlockDeepLink(ctx, lang, candidateId) {
  const buyerId = ctx.from.id;

  if (candidateId && canViewProfile(buyerId, candidateId)) {
    await revealProfile(ctx, lang, candidateId);
    return;
  }

  const orderId = candidateId ? createOrder(buyerId, { type: "unlock", targetId: candidateId }) : null;
  const clickUrl = orderId ? buildCheckoutUrl(orderId, UNLOCK_PRICE_SOM) : null;

  const unlockButton = clickUrl
    ? Markup.button.url(t(lang, "unlockPayButton"), clickUrl)
    : Markup.button.callback(t(lang, "unlockPayButton"), "unlock:noop");
  const premiumButton = Markup.button.callback(t(lang, "unlockPremiumButton"), "premium:offer");

  await ctx.reply(t(lang, "unlockPaywallIntro"), Markup.inlineKeyboard([[premiumButton], [unlockButton]]));
}

module.exports = {
  registerDiscoverHandlers,
  handleUnlockDeepLink,
  sendCandidate,
  buildProfileCaption,
  canViewProfile,
  viewProfileKeyboard,
};
