const { Markup } = require("telegraf");
const { getProfile, getLikers, getLanguage, hasLiked, getDislikes, recordDislike } = require("./db");
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

// Buttons under an undecided liker. The index rides along in the callback
// data so tapping either one can move straight to the next card without
// keeping a cursor in memory that a restart would lose.
function respondKeyboard(candidateId, index) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(LIKE, `likeback:like:${candidateId}:${index}`),
      Markup.button.callback(DISLIKE, `likeback:dislike:${candidateId}:${index}`),
    ],
  ]);
}

// The only button under someone already dealt with: there is nothing left to
// decide about them, just somewhere else to go.
function nextKeyboard(lang, index, total) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, "likesNextButton")(index + 2, total), `likes:at:${index + 1}`)],
  ]);
}

// Who is actually waiting on a decision, in a stable order.
//
// People this viewer has already turned down are filtered out: 👎 used to
// only delete the message off the screen, so the same person was back at the
// top of the list the very next time it was opened, forever.
async function loadLikerQueue(myId) {
  const [likerIds, dislikedIds] = await Promise.all([getLikers(myId), getDislikes(myId)]);
  const disliked = new Set(dislikedIds.map(String));
  const pending = likerIds.filter((id) => !disliked.has(String(id)));

  // Loaded in parallel -- one sequential await per liker would be a
  // round-trip each against a database backend.
  const loaded = await Promise.all(pending.map(async (id) => ({ id, profile: await getProfile(id) })));
  return loaded.filter((entry) => entry.profile?.mediaFileId && entry.profile.active !== false);
}

// ONE liker at a time. This used to loop over the whole list and fire a card
// per person in one go, so opening it with a dozen admirers dumped a dozen
// photos into the chat at once and there was no sense of working through
// them -- the answer to each was buried somewhere up the scrollback.
//
// The position is carried in the callback data rather than held in memory,
// so a restart mid-list costs nothing and two devices can't disagree about
// where this person is.
async function showLikerAt(ctx, index) {
  const myId = ctx.from.id;
  const lang = (await getLanguage(myId)) || DEFAULT_LANG;

  // The viewer's own profile rides along: its location is what the card's
  // distance is measured from.
  const [me, likers] = await Promise.all([getProfile(myId), loadLikerQueue(myId)]);

  if (likers.length === 0) {
    await ctx.reply(t(lang, "noLikesYet"));
    return;
  }
  // The list can shrink between rendering a button and it being tapped (the
  // person deactivated, or was answered from another device), so an index
  // past the end means "done", not an error.
  if (index >= likers.length) {
    await ctx.reply(t(lang, "likesAllSeen"));
    return;
  }

  const { id, profile } = likers[index];

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

  // includeUnlock is always false here: liking back is the free path already
  // offered right on this card via the ❤️ button, so there is nothing to
  // pitch a paywall for.
  const captionOptions = {
    includeUnlock: false,
    viewerLocation: me?.location,
    ...(canSee ? { contactPhone: profile.phone } : {}),
  };

  // Already decided: nothing to press but "next" -- and only when there IS
  // a next. Still undecided: ❤️/👎, either of which moves on by itself.
  const keyboard = mutualMatch
    ? index + 1 < likers.length
      ? nextKeyboard(lang, index, likers.length)
      : undefined
    : respondKeyboard(id, index);

  await sendCandidate(ctx, lang, id, profile, keyboard, captionOptions);
}

// Shared by the "💌 Kimlar yoqtirdi" menu button AND the "Kim layk bosganini
// ko'rish" button attached to a new-like notification -- both must open the
// exact same list, not two drifting copies of it.
async function showLikers(ctx) {
  const myId = ctx.from.id;
  const lang = (await getLanguage(myId)) || DEFAULT_LANG;
  const likers = await loadLikerQueue(myId);

  if (likers.length === 0) {
    await ctx.reply(t(lang, "noLikesYet"));
    return;
  }

  await ctx.reply(t(lang, "likesIntro")(likers.length));
  await showLikerAt(ctx, 0);
}

function registerLikesHandlers(bot) {
  const likesLabels = Object.values(STRINGS).map((dict) => dict.menu.likes);

  bot.hears(likesLabels, showLikers);

  // Fired by the button under a "someone liked you" notification.
  bot.action("likes:show", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await showLikers(ctx);
  });

  // Step to a given position in the list, from the "next" button.
  bot.action(/^likes:at:(\d+)$/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await showLikerAt(ctx, Number(ctx.match[1]));
  });

  // The index is optional so that ❤️/👎 buttons on cards sent before this
  // became a one-at-a-time list still work -- they just don't auto-advance,
  // exactly as they behaved when they were sent.
  bot.action(/^likeback:like:([^:]+)(?::(\d+))?$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const index = ctx.match[2] === undefined ? null : Number(ctx.match[2]);
    const myId = ctx.from.id;
    const lang = await getLanguage(myId) || DEFAULT_LANG;
    // skipResponderCard: the card is rewritten in place below, so a second
    // copy of the same profile pushed underneath it would just be noise.
    await recordLikeWithMatchNotification(ctx, myId, candidateId, { skipResponderCard: true });
    await safeAnswerCbQuery(ctx, t(lang, "matchedToast"));

    const candidate = await getProfile(candidateId);
    if (!candidate) return;

    // Asks the one question that decides this everywhere: does this viewer
    // actually have access? Answering a like makes it a match, and a match
    // grants both sides -- but this still asks rather than assuming, because
    // "mutual likes" and "has access" are separate facts (Premium, a paid
    // unlock, a spent credit) and only one of them is the question here.
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

    // Answering IS the "next" tap -- one decision, one card, no extra button
    // to find. The answered person stays in the list (they are still someone
    // who liked you), so the position after them is index + 1.
    if (index !== null) await showLikerAt(ctx, index + 1);
  });

  bot.action(/^likeback:dislike:([^:]+)(?::(\d+))?$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const index = ctx.match[2] === undefined ? null : Number(ctx.match[2]);
    await safeAnswerCbQuery(ctx);

    // Recorded, not just removed from the screen. Without this, "no thanks"
    // meant nothing at all: the same person was back at the top of the list
    // the very next time it was opened.
    await recordDislike(ctx.from.id, candidateId);

    try {
      await ctx.deleteMessage();
    } catch (err) {
      console.error("likeback:dislike deleteMessage failed (ignored):", err.message);
    }

    // The turned-down person has just left the queue, so the NEXT card has
    // slid into the index they were occupying -- not index + 1, which would
    // skip somebody.
    if (index !== null) await showLikerAt(ctx, index);
  });
}

module.exports = { registerLikesHandlers };
