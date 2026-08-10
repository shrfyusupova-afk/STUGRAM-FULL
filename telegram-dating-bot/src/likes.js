const { Markup } = require("telegraf");
const { getProfile, getLikers, getLanguage, hasLiked } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const {
  sendCandidate,
  buildProfileCaption,
  recordLikeWithMatchNotification,
  canViewProfile,
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
// match, in which case there's nothing left to decide.
//
// Shared by the "💌 Kimlar yoqtirdi" menu button AND the "Kim layk bosganini
// ko'rish" button attached to a new-like notification -- both must open the
// exact same list, not two drifting copies of it.
async function showLikers(ctx) {
  const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
  const myId = ctx.from.id;
  const likerIds = await getLikers(myId);
  // Loaded in parallel -- one sequential await per liker would be a round-trip
  // each against a database backend. The viewer's own profile joins the same
  // batch: its location is what every card's distance is measured from.
  const [me, loaded] = await Promise.all([
    getProfile(myId),
    Promise.all(likerIds.map(async (id) => ({ id, profile: await getProfile(id) }))),
  ]);
  const likers = loaded.filter((entry) => entry.profile?.mediaFileId && entry.profile.active !== false);

  if (likers.length === 0) {
    await ctx.reply(t(lang, "noLikesYet"));
    return;
  }

  await ctx.reply(t(lang, "likesIntro")(likers.length));
  for (const { id, profile } of likers) {
    // Whether to show ❤️/👎 vs. the contact directly depends ONLY on
    // whether it's a genuine mutual like -- NOT on canViewProfile (which
    // also covers Premium/paid-unlock). Otherwise a Premium user would
    // never see the ❤️ button here at all, could never like a liker back,
    // and the other person would never get notified of a real match.
    // includeUnlock is always false here: liking back is the free path
    // already offered right on this card via the ❤️ button, so there's
    // nothing to pitch a paywall for. A mutual match reveals the contact
    // directly on the card -- no separate "View profile" tap needed.
    // Two different questions, deliberately answered by two different rules.
    //
    // Whether to show ❤️/👎 depends only on whether this is already a mutual
    // like: using canViewProfile here would hide ❤️ from a Premium user, who
    // could then never like a liker back and the other person would never be
    // told about a real match.
    //
    // Whether to show the CONTACT is canViewProfile, because a match no
    // longer grants it to both sides -- it goes to whoever liked first. Left
    // on mutualMatch, this list quietly handed the number to the responder
    // anyway, one screen away from the paywall that had just refused them.
    const mutualMatch = (await hasLiked(myId, id)) && (await hasLiked(id, myId));
    const canSee = await canViewProfile(myId, id);
    const captionOptions = canSee
      ? { includeUnlock: false, contactPhone: profile.phone, viewerLocation: me?.location }
      : { includeUnlock: false, viewerLocation: me?.location };
    const keyboard = mutualMatch ? undefined : respondKeyboard(id);
    await sendCandidate(ctx, lang, id, profile, keyboard, captionOptions);
  }
}

function registerLikesHandlers(bot) {
  const likesLabels = Object.values(STRINGS).map((dict) => dict.menu.likes);

  bot.hears(likesLabels, showLikers);

  // Fired by the button under a "someone liked you" notification.
  bot.action("likes:show", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await showLikers(ctx);
  });

  bot.action(/^likeback:like:(.+)$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const myId = ctx.from.id;
    const lang = await getLanguage(myId) || DEFAULT_LANG;
    await recordLikeWithMatchNotification(ctx, myId, candidateId);
    await safeAnswerCbQuery(ctx, t(lang, "matchedToast"));

    const candidate = await getProfile(candidateId);
    if (!candidate) return;

    // Asks the one question that decides this everywhere: does this viewer
    // actually have access? A mutual like is no longer enough on its own --
    // on a match the contact goes to whoever liked FIRST, and answering a
    // like is by definition not that. Reading "mutual" here instead was
    // exactly how the responder kept seeing the number.
    const canSee = await canViewProfile(myId, candidateId);
    const me = await getProfile(myId);
    const caption = buildProfileCaption(lang, candidateId, candidate, {
      includeUnlock: false,
      viewerLocation: me?.location,
      ...(canSee ? { contactPhone: candidate.phone } : {}),
    });

    try {
      // Rewrites the existing card: the photo and details stay where they
      // are, the contact and profile link simply appear underneath them, and
      // the ❤️/👎 buttons go away since there is nothing left to decide.
      await ctx.editMessageCaption(caption, { parse_mode: "HTML" });
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
