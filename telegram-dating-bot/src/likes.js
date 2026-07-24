const { Markup } = require("telegraf");
const { getProfile, getLikers, getLanguage, hasLiked } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const {
  sendCandidate,
  buildProfileCaption,
  canViewProfile,
  viewProfileKeyboard,
  recordLikeWithMatchNotification,
} = require("./discover");
const { safeAnswerCbQuery } = require("./telegramSafety");

const LIKE = "❤️";
const DISLIKE = "👎";

function respondKeyboard(candidateId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(LIKE, `likeback:like:${candidateId}`), Markup.button.callback(DISLIKE, `likeback:dislike:${candidateId}`)],
  ]);
}

// Reuses discover.js's card renderer. Each liker gets its own inline
// ❤️/👎 pair (not the reply-keyboard swipe buttons, which can't tell which
// of several cards on screen they refer to) unless it's already a mutual
// match, in which case there's nothing left to decide -- just a button to
// view the profile.
function registerLikesHandlers(bot) {
  const likesLabels = Object.values(STRINGS).map((dict) => dict.menu.likes);

  bot.hears(likesLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const myId = ctx.from.id;
    const likerIds = getLikers(myId);
    const likers = likerIds
      .map((id) => ({ id, profile: getProfile(id) }))
      .filter((entry) => entry.profile?.mediaFileId && entry.profile.active !== false);

    if (likers.length === 0) {
      await ctx.reply(t(lang, "noLikesYet"));
      return;
    }

    await ctx.reply(t(lang, "likesIntro")(likers.length));
    for (const { id, profile } of likers) {
      // Whether to show ❤️/👎 vs. the view button depends ONLY on whether
      // it's a genuine mutual like -- NOT on canViewProfile (which also
      // covers Premium/paid-unlock). Otherwise a Premium user would never
      // see the ❤️ button here at all, could never like a liker back, and
      // the other person would never get notified of a real match.
      // includeUnlock, separately, is fine to base on canViewProfile: it
      // just controls whether the caption still pitches the paywall to
      // someone who doesn't need to pay.
      const mutualMatch = hasLiked(myId, id) && hasLiked(id, myId);
      const freeAccess = canViewProfile(myId, id);
      const keyboard = mutualMatch ? viewProfileKeyboard(lang, id) : respondKeyboard(id);
      await sendCandidate(ctx, lang, id, profile, keyboard, { includeUnlock: !freeAccess });
    }
  });

  bot.action(/^likeback:like:(.+)$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const myId = ctx.from.id;
    const lang = getLanguage(myId) || DEFAULT_LANG;
    await recordLikeWithMatchNotification(ctx, myId, candidateId);
    await safeAnswerCbQuery(ctx, t(lang, "matchedToast"));

    const candidate = getProfile(candidateId);
    if (!candidate) return;
    try {
      await ctx.editMessageCaption(buildProfileCaption(lang, candidateId, candidate, { includeUnlock: false }), {
        parse_mode: "HTML",
        reply_markup: viewProfileKeyboard(lang, candidateId).reply_markup,
      });
    } catch (err) {
      console.error("likeback:like editMessageCaption failed (ignored):", err.message);
    }
  });

  bot.action(/^likeback:dislike:(.+)$/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    try {
      await ctx.deleteMessage();
    } catch (err) {
      console.error("likeback:dislike deleteMessage failed (ignored):", err.message);
    }
  });
}

module.exports = { registerLikesHandlers };
