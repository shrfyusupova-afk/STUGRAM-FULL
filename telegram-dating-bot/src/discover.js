const { Markup } = require("telegraf");
const {
  getProfile,
  getAllProfiles,
  getLanguage,
  recordLike,
  hasLiked,
  hasUnlocked,
  hasPremium,
  recordDislike,
  getDislikes,
  getDiscoverState,
  setDiscoverState,
  clearDiscoverState,
} = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { getUsername } = require("./botInfo");
const { sendMainMenu } = require("./menu");
const { createOrder, buildCheckoutUrl, UNLOCK_PRICE_SOM } = require("./click");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { leaveAnonQueueOrChat } = require("./anonChat");

function isPremiumProfile(profile) {
  return !!profile?.premiumUntil && new Date(profile.premiumUntil) > new Date();
}

const LIKE = "❤️";
const DISLIKE = "👎";

// Premium profiles are shown more often: each copy of a premium candidate is
// added to the random-pick pool this many times over.
const PREMIUM_VISIBILITY_WEIGHT = 3;

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
  const disliked = new Set(getDislikes(userId));
  const pool = Object.entries(all).filter(
    ([id, p]) =>
      id !== String(userId) &&
      p.gender === wanted &&
      p.mediaFileId &&
      p.phone &&
      p.active !== false &&
      !disliked.has(id)
  );
  if (pool.length === 0) return null;

  // Persisted (not just in-memory) so a Render restart mid-session can't
  // desync "what's on screen" from the next ❤️/👎 tap.
  const persisted = getDiscoverState(userId) || { currentId: null, shown: [] };
  let shown = new Set(persisted.shown);

  let remaining = pool.filter(([id]) => !shown.has(id));
  if (remaining.length === 0) {
    shown = new Set();
    remaining = pool;
  }

  // Uses the profile object already loaded in `all` rather than calling
  // hasPremium(id) (which would re-read the entire profiles.json file once
  // per candidate) -- same check, no redundant I/O.
  const weighted = [];
  for (const entry of remaining) {
    const [, p] = entry;
    const copies = isPremiumProfile(p) ? PREMIUM_VISIBILITY_WEIGHT : 1;
    for (let i = 0; i < copies; i++) weighted.push(entry);
  }

  const [id, profile] = weighted[Math.floor(Math.random() * weighted.length)];
  shown.add(id);
  setDiscoverState(userId, { currentId: id, shown: [...shown] });
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
    `${t(lang, "bioLabel")}\n<i>${escapeHtml(profile.bio)}</i>`;

  if (contactPhone) {
    return `${base}\n\n📞 ${escapeHtml(contactPhone)}`;
  }

  if (!includeUnlock) return base;

  const username = getUsername();
  const unlockUrl = username ? `https://t.me/${username}?start=unlock_${candidateId}` : null;
  // unlockLinkText already includes its own 🔐 prefix -- don't add a second one here.
  const unlockLabel = escapeHtml(t(lang, "unlockLinkText")(UNLOCK_PRICE_SOM.toLocaleString("uz-UZ")));
  const unlockLine = unlockUrl ? `<a href="${unlockUrl}">${unlockLabel}</a>` : unlockLabel;

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

// True once the viewer can see this candidate's contact for free: they paid
// for a one-time unlock, both sides have liked each other, or the viewer has
// an active Premium subscription (its whole point is unlimited access).
function canViewProfile(viewerId, candidateId) {
  return (
    hasUnlocked(viewerId, candidateId) ||
    hasPremium(viewerId) ||
    (hasLiked(viewerId, candidateId) && hasLiked(candidateId, viewerId))
  );
}

// Sends a candidate's profile straight to an arbitrary chat (not necessarily
// the current ctx's chat) with the contact phone already revealed -- no
// "View profile" button/tap in between. Used to show both sides of a match
// their new profile immediately, right under the "matched!" text.
async function sendProfileToChat(telegram, chatId, lang, candidateId) {
  const candidate = getProfile(candidateId);
  if (!candidate) return;
  const caption = buildProfileCaption(lang, candidateId, candidate, { includeUnlock: false, contactPhone: candidate.phone });
  const extra = { caption, parse_mode: "HTML" };
  if (candidate.mediaType === "video") {
    await telegram.sendVideo(chatId, candidate.mediaFileId, extra);
  } else {
    await telegram.sendPhoto(chatId, candidate.mediaFileId, extra);
  }
}

async function revealProfile(ctx, lang, candidateId) {
  const candidate = getProfile(candidateId);
  if (!candidate) {
    await ctx.reply(t(lang, "unlockSuccessNoContact"));
    return;
  }
  await sendCandidate(ctx, lang, candidateId, candidate, undefined, { includeUnlock: false, contactPhone: candidate.phone });
}

// Shared by the discover swipe (❤️) and the "who liked me" like-back button --
// records the like, and if that's the like that JUST completed a mutual
// match (the other side already liked first, and this is the first time we
// like them back), pushes a "you matched" message straight to both sides,
// with the other person's profile (contact revealed) sent right underneath
// -- no "View profile" tap required. A repeat tap on an already-mutual pair
// is a no-op here (recordLike is idempotent) and must not re-notify.
async function recordLikeWithMatchNotification(ctx, likerId, likedId) {
  const alreadyLikedByMe = hasLiked(likerId, likedId);
  recordLike(likerId, likedId);
  if (alreadyLikedByMe || !hasLiked(likedId, likerId)) return;

  const me = getProfile(likerId);
  const them = getProfile(likedId);
  if (!me || !them) return;

  const myLang = getLanguage(likerId) || DEFAULT_LANG;
  const theirLang = getLanguage(likedId) || DEFAULT_LANG;

  try {
    await ctx.telegram.sendMessage(
      likerId,
      `${t(myLang, "matchNotification")(them.name)}\n\n${t(myLang, "profileBelowIntro")}`
    );
    await sendProfileToChat(ctx.telegram, likerId, myLang, likedId);
  } catch (err) {
    console.error("match notification (liker) failed:", err.message);
  }
  try {
    await ctx.telegram.sendMessage(
      likedId,
      `${t(theirLang, "matchNotification")(me.name)}\n\n${t(theirLang, "profileBelowIntro")}`
    );
    await sendProfileToChat(ctx.telegram, likedId, theirLang, likerId);
  } catch (err) {
    console.error("match notification (liked) failed:", err.message);
  }
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
    const state = getDiscoverState(ctx.from.id);
    if (state?.currentId) {
      await recordLikeWithMatchNotification(ctx, ctx.from.id, state.currentId);
    }
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender);
  });

  bot.hears(DISLIKE, async (ctx) => {
    const state = getDiscoverState(ctx.from.id);
    if (state?.currentId) {
      recordDislike(ctx.from.id, state.currentId);
    }
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender);
  });

  // Scoped to whichever screen actually shows this label: while the profile
  // wizard scene is active, its own internal handler intercepts it first
  // (Telegraf runs scene middleware before this), so this only fires when
  // "Back" is tapped from the discover keyboard (or any other screen using
  // this same shared label, e.g. anon chat's submenu -- also cleans up any
  // pending anon search or active chat, since backing out of ANY screen
  // should end an in-progress anon session too).
  bot.hears(backLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    clearDiscoverState(ctx.from.id);
    await leaveAnonQueueOrChat(ctx.telegram, ctx.from.id);
    if (me) {
      await sendMainMenu(ctx, lang);
    }
  });

  bot.action("unlock:noop", async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "unlockNotConfigured"));
  });

  // Kept for messages sent before profile reveals became direct (no button) --
  // re-checks access before revealing anything, since a forwarded/stale
  // button could otherwise leak it.
  bot.action(/^unlock:view:(.+)$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
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
  sendProfileToChat,
  buildProfileCaption,
  canViewProfile,
  recordLikeWithMatchNotification,
};
