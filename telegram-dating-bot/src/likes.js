const { getProfile, getLikers, getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { sendCandidate } = require("./discover");

// Reuses discover.js's card renderer but with no keyboard argument, so it
// doesn't touch whatever keyboard (main menu / discover swipe buttons) is
// currently docked for this chat.
function registerLikesHandlers(bot) {
  const likesLabels = Object.values(STRINGS).map((dict) => dict.menu.likes);

  bot.hears(likesLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const likerIds = getLikers(ctx.from.id);
    const likers = likerIds
      .map((id) => ({ id, profile: getProfile(id) }))
      .filter((entry) => entry.profile?.mediaFileId);

    if (likers.length === 0) {
      await ctx.reply(t(lang, "noLikesYet"));
      return;
    }

    await ctx.reply(t(lang, "likesIntro")(likers.length));
    for (const { id, profile } of likers) {
      await sendCandidate(ctx, lang, id, profile);
    }
  });
}

module.exports = { registerLikesHandlers };
