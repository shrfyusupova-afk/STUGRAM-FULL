const { Markup } = require("telegraf");
const {
  getProfile,
  getLikers,
  getLanguage,
  hasLiked,
  getDislikes,
  recordDislike,
  getDiscoverState,
  setDiscoverState,
} = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const {
  sendCandidate,
  buildProfileCaption,
  recordLikeWithMatchNotification,
  canViewProfile,
  discoverKeyboard,
  LIKE,
  DISLIKE,
} = require("./discover");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { mainMenuKeyboard } = require("./menu");

// Who is currently working through their likes list rather than browsing.
//
// ONLY the mode lives here. Who is on screen is discoverState's currentId --
// the same field the browse screen uses, because it means the same thing.
// That split is deliberate: if this map is lost (a restart, a sweep), a ❤️
// still lands on the right person, it just carries on into browsing instead
// of the next admirer. A cursor kept here instead would have been able to
// point at somebody else entirely.
const browsing = new Map(); // userId -> last touched, ms

// An entry left behind by somebody who wandered off mid-list would otherwise
// sit here forever -- the same unbounded-growth shape swept everywhere else
// in this codebase.
const BROWSING_TTL_MS = 60 * 60 * 1000;
const BROWSING_SWEEP_MS = 15 * 60 * 1000;

function sweepBrowsing(now = Date.now()) {
  let removed = 0;
  for (const [userId, touchedAt] of browsing) {
    if (now - touchedAt > BROWSING_TTL_MS) {
      browsing.delete(userId);
      removed++;
    }
  }
  return removed;
}
setInterval(sweepBrowsing, BROWSING_SWEEP_MS).unref();

function isBrowsingLikes(userId) {
  const touchedAt = browsing.get(String(userId));
  if (touchedAt === undefined) return false;
  if (Date.now() - touchedAt > BROWSING_TTL_MS) {
    browsing.delete(String(userId));
    return false;
  }
  return true;
}

// The "next" button, kept only for cards sent before the ❤️/👎 controls moved
// to the keyboard under the chat -- those messages are still on people's
// screens and their buttons still have to work.
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
  const [likerIds, dislikedIds, me] = await Promise.all([
    getLikers(myId),
    getDislikes(myId),
    getProfile(myId),
  ]);
  const disliked = new Set(dislikedIds.map(String));
  const pending = likerIds.filter((id) => !disliked.has(String(id)));

  // Loaded in parallel -- one sequential await per liker would be a
  // round-trip each against a database backend.
  const loaded = await Promise.all(pending.map(async (id) => ({ id, profile: await getProfile(id) })));

  // The same gender rule browsing uses. Only the opposite gender can reach
  // this list in the first place -- likes are only ever given from a screen
  // that already filters -- with one exception: somebody who liked you and
  // THEN changed their own gender. Their like is still on record, and without
  // this it comes back as a same-gender card on a screen that looks exactly
  // like browsing.
  const wanted = me?.gender === "male" ? "female" : me?.gender === "female" ? "male" : null;

  return loaded.filter(
    (entry) =>
      entry.profile?.mediaFileId &&
      entry.profile.active !== false &&
      // No gender on the viewer means we cannot tell -- show everything
      // rather than emptying somebody's list over a missing field.
      (wanted === null || entry.profile.gender === wanted)
  );
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
    browsing.delete(String(myId));
    await ctx.reply(t(lang, "noLikesYet"), mainMenuKeyboard(lang));
    return;
  }
  // The list can shrink between rendering a button and it being tapped (the
  // person deactivated, or was answered from another device), so an index
  // past the end means "done", not an error.
  if (index >= likers.length) {
    // Nobody left to decide about, so ❤️/👎 under the chat would do nothing.
    // Hand the main menu back rather than leaving dead controls on screen --
    // the same thing browsing does when it runs out of candidates.
    browsing.delete(String(myId));
    await ctx.reply(t(lang, "likesAllSeen"), mainMenuKeyboard(lang));
    return;
  }

  const { id, profile } = likers[index];

  const canSee = await canViewProfile(myId, id);

  // includeUnlock is always false here: liking back is the free path already
  // offered by the ❤️ under the chat, so there is nothing to pitch a paywall
  // for.
  const captionOptions = {
    includeUnlock: false,
    viewerLocation: me?.location,
    ...(canSee ? { contactPhone: profile.phone } : {}),
  };

  // Who is on screen, written where the browse screen writes it -- so ❤️, 👎
  // and "report" all act on this person no matter which handler picks the tap
  // up, including after a restart that loses `browsing`.
  const state = (await getDiscoverState(myId)) || {};
  await setDiscoverState(myId, { currentId: String(id), shown: state.shown || [] });
  browsing.set(String(myId), Date.now());

  // The same controls as browsing, in the same place: ❤️ / 👎, report, back.
  // They used to be inline buttons on the card while the keyboard under the
  // chat still showed the main menu -- so the two rows of controls on screen
  // disagreed about what this screen was for.
  await sendCandidate(ctx, lang, id, profile, discoverKeyboard(lang), captionOptions);
}

// One step on from whoever is on screen.
//
// The index is recomputed from the queue rather than remembered, because the
// queue changes underneath: turning somebody down removes them, so the next
// person slides into the index just vacated. `after` says which of those two
// happened -- true for ❤️ (they stay in the list), false for 👎 (they leave).
async function advanceFrom(ctx, currentId, { after }) {
  const likers = await loadLikerQueue(ctx.from.id);
  const index = likers.findIndex((entry) => String(entry.id) === String(currentId));
  // Not found means they have already left the queue (turned down, or their
  // profile went away), so the position they held is where the next one is.
  if (index === -1) return showLikerAt(ctx, 0);
  return showLikerAt(ctx, after ? index + 1 : index);
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
  const discoverLabels = Object.values(STRINGS).map((dict) => dict.menu.discover);
  const backLabels = Object.values(STRINGS).map((dict) => dict.backButton);

  bot.hears(likesLabels, showLikers);

  // --- the keyboard under the chat ------------------------------------------
  //
  // ❤️ / 👎 / report / back are the SAME labels the browse screen uses, and
  // this file is registered first (see index.js) so these get first refusal on
  // them. Every one of them hands the tap straight on with next() unless this
  // person is actually working through their likes list, so browsing behaves
  // exactly as it did.
  //
  // "Report" is deliberately absent: the browse screen's own handler reads
  // whoever is on screen from discoverState, which showLikerAt has already
  // set to the current admirer -- so it reports the right person with no
  // second copy of that logic here.

  bot.hears(LIKE, async (ctx, next) => {
    if (!isBrowsingLikes(ctx.from.id)) return next();
    const state = await getDiscoverState(ctx.from.id);
    if (!state?.currentId) return next();

    await recordLikeWithMatchNotification(ctx, ctx.from.id, state.currentId);
    // They stay in the list -- somebody who liked you is still somebody who
    // liked you after you answer -- so the next card is the one after them.
    await advanceFrom(ctx, state.currentId, { after: true });
  });

  bot.hears(DISLIKE, async (ctx, next) => {
    if (!isBrowsingLikes(ctx.from.id)) return next();
    const state = await getDiscoverState(ctx.from.id);
    if (!state?.currentId) return next();

    // Recorded, not just skipped: without this the same person is back at the
    // top of the list the very next time it is opened.
    await recordDislike(ctx.from.id, state.currentId);
    // They have just left the queue, so the next person has slid into the
    // position they were occupying.
    await advanceFrom(ctx, state.currentId, { after: false });
  });

  // Leaving. The browse screen's handler does the actual work (clears the
  // state, ends any anon session, sends the main menu); this only has to
  // forget the mode so a later ❤️ is not still read as a likes answer.
  bot.hears(backLabels, async (ctx, next) => {
    browsing.delete(String(ctx.from.id));
    return next();
  });

  // Same reason in the other direction: opening the browse screen must not
  // leave the likes mode set, or the first ❤️ there would try to answer an
  // admirer instead of the candidate on screen.
  bot.hears(discoverLabels, async (ctx, next) => {
    browsing.delete(String(ctx.from.id));
    return next();
  });

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
    await recordLikeWithMatchNotification(ctx, myId, candidateId);
    await safeAnswerCbQuery(ctx, t(lang, "matchedToast"));

    const candidate = await getProfile(candidateId);
    if (!candidate) return;

    // Asks the one question that decides this everywhere: does this viewer
    // actually have access? A mutual like is not enough on its own -- on a
    // match the contact goes to whoever liked FIRST, and answering a like is
    // by definition not that. Reading "mutual" here instead was exactly how
    // the responder kept seeing the number.
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
