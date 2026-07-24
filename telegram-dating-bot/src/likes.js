const { Markup } = require("telegraf");
const { getProfile, getLikers, getLanguage, recordLike } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { sendCandidate, buildProfileCaption, canViewProfile, viewProfileKeyboard } = require("./discover");

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
      .filter((entry) => entry.profile?.mediaFileId);

    if (likers.length === 0) {
      await ctx.reply(t(lang, "noLikesYet"));
      return;
    }

    await ctx.reply(t(lang, "likesIntro")(likers.length));
    for (const { id, profile } of likers) {
      const matched = canViewProfile(myId, id);
      const keyboard = matched ? viewProfileKeyboard(lang, id) : respondKeyboard(id);
      await sendCandidate(ctx, lang, id, profile, keyboard, { includeUnlock: !matched });
    }
  });

  bot.action(/^likeback:like:(.+)$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const myId = ctx.from.id;
    const lang = getLanguage(myId) || DEFAULT_LANG;
    recordLike(myId, candidateId);
    await ctx.answerCbQuery(t(lang, "matchedToast"));

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
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch (err) {
      console.error("likeback:dislike deleteMessage failed (ignored):", err.message);
    }
  });
}

module.exports = { registerLikesHandlers };
