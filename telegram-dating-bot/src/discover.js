const { Markup } = require("telegraf");
const {
  getProfile,
  getAllProfiles,
  pickCandidateRow,
  getLanguage,
  recordLike,
  getLikers,
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
const { promptForComplaint, SOURCE } = require("./complaints");
const { profileLinkHref } = require("./profileLink");
const { isRegistered } = require("./profileState");

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

// Applied to every message carrying somebody else's photo or video.
//
// What it actually does, so nobody is promised more than it delivers:
//   * forwarding the card to another chat -- blocked, on every platform;
//   * saving/downloading the photo to the phone -- blocked, every platform;
//   * screenshots -- blocked on Android, where Telegram marks the window
//     secure. Apple does not let ANY app block screenshots, so on iPhone the
//     screen can still be captured, and any phone can photograph any screen.
//
// So this raises the effort a lot without being a guarantee; the honest half
// of the answer is the warning shown alongside it and the reporting route
// for someone who does pass a photo around.
const PROTECTED = { protect_content: true };

function oppositeGender(gender) {
  return gender === "male" ? "female" : "male";
}

// How many "already seen" ids are remembered per person. Without a cap this
// list grew by one on EVERY swipe and was rewritten to storage each time, so
// an active user's row kept getting heavier forever -- at a few thousand
// profiles it was tens of kilobytes per user, read and written on every tap.
// Once the cap is reached the oldest ids drop off, which only means someone
// seen 500 swipes ago may come round again -- exactly what the recycling
// branch does anyway.
const MAX_SHOWN_MEMORY = 500;

// Newest last, no duplicates, oldest trimmed off the front.
function rememberShown(shown, id) {
  const next = shown.filter((seen) => seen !== id);
  next.push(id);
  if (next.length > MAX_SHOWN_MEMORY) next.splice(0, next.length - MAX_SHOWN_MEMORY);
  return next;
}

async function readShown(userId) {
  const persisted = (await getDiscoverState(userId)) || {};
  return Array.isArray(persisted.shown) ? persisted.shown.map(String) : [];
}

// Postgres path: all the filtering and the weighted random pick happen in one
// query, so a swipe costs the same whether there are 300 profiles or 300 000.
async function pickCandidateFromDb(userId, wanted) {
  const shown = await readShown(userId);
  const picked = await pickCandidateRow(userId, wanted, shown, PREMIUM_VISIBILITY_WEIGHT);
  if (!picked) return null;

  const id = String(picked.id);
  // `recycled` means the query had to ignore the shown list to find anybody --
  // everyone available has been seen, so the cycle starts over from this one.
  const nextShown = picked.recycled ? [id] : rememberShown(shown, id);
  await setDiscoverState(userId, { currentId: id, shown: nextShown });
  return { id, profile: picked.profile };
}

// JSON path: no query engine to push the work into, so the whole file is read
// and filtered here. Kept for local development and for any deploy still
// running without DATABASE_URL.
async function pickCandidateFromMemory(userId, wanted) {
  const all = await getAllProfiles();
  const disliked = new Set(await getDislikes(userId));
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
  let shown = await readShown(userId);
  let seen = new Set(shown);

  let remaining = pool.filter(([id]) => !seen.has(id));
  if (remaining.length === 0) {
    shown = [];
    remaining = pool;
  }

  // Uses the profile object already loaded in `all` rather than calling
  // hasPremium(id) -- same check, one fewer query/read per candidate.
  const weighted = [];
  for (const entry of remaining) {
    const [, p] = entry;
    const copies = isPremiumProfile(p) ? PREMIUM_VISIBILITY_WEIGHT : 1;
    for (let i = 0; i < copies; i++) weighted.push(entry);
  }

  const [id, profile] = weighted[Math.floor(Math.random() * weighted.length)];
  await setDiscoverState(userId, { currentId: id, shown: rememberShown(shown, id) });
  return { id, profile };
}

async function pickCandidate(userId, myGender) {
  const wanted = oppositeGender(myGender);
  if (pickCandidateRow) return pickCandidateFromDb(userId, wanted);
  return pickCandidateFromMemory(userId, wanted);
}

// The report button sits directly above Back, as a normal keyboard button.
// It carries no id of its own -- which candidate it refers to is simply
// whoever is currently on screen, which discoverState already tracks.
function discoverKeyboard(lang) {
  return Markup.keyboard([
    [LIKE, DISLIKE],
    [t(lang, "reportUserButton")],
    [t(lang, "backButton")],
  ]).resize();
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
    // Opens that person's Telegram straight from the caption, so the viewer
    // can message them in one tap instead of copying a phone number into
    // their contacts first. profileLinkHref picks a form that actually
    // renders as a link -- see the note there about tg://user silently
    // degrading to plain text.
    const href = profileLinkHref(candidateId, profile);
    const openLink = `<a href="${href}">${escapeHtml(t(lang, "openProfileLink"))}</a>`;
    return `${base}\n\n📞 ${escapeHtml(contactPhone)}\n${openLink}`;
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
  const extra = { caption, parse_mode: "HTML", ...PROTECTED, ...(keyboardExtra || {}) };

  if (profile.mediaType === "video") {
    await ctx.replyWithVideo(profile.mediaFileId, extra);
  } else {
    await ctx.replyWithPhoto(profile.mediaFileId, extra);
  }
}

// True once the viewer can see this candidate's contact for free: they paid
// for a one-time unlock, both sides have liked each other, or the viewer has
// an active Premium subscription (its whole point is unlimited access).
async function canViewProfile(viewerId, candidateId) {
  return (
    await hasUnlocked(viewerId, candidateId) ||
    await hasPremium(viewerId) ||
    (await hasLiked(viewerId, candidateId) && await hasLiked(candidateId, viewerId))
  );
}

// Sends a candidate's profile straight to an arbitrary chat (not necessarily
// the current ctx's chat) with the contact phone already revealed -- no
// "View profile" button/tap in between. Used to show both sides of a match
// their new profile immediately, right under the "matched!" text.
async function sendProfileToChat(telegram, chatId, lang, candidateId) {
  const candidate = await getProfile(candidateId);
  if (!candidate) return;
  const caption = buildProfileCaption(lang, candidateId, candidate, { includeUnlock: false, contactPhone: candidate.phone });
  const extra = { caption, parse_mode: "HTML", ...PROTECTED };
  if (candidate.mediaType === "video") {
    await telegram.sendVideo(chatId, candidate.mediaFileId, extra);
  } else {
    await telegram.sendPhoto(chatId, candidate.mediaFileId, extra);
  }
}

async function revealProfile(ctx, lang, candidateId) {
  const candidate = await getProfile(candidateId);
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
// How many people have liked this user WITHOUT being liked back yet -- i.e.
// how many are still waiting for a decision. That's the number worth showing,
// since already-matched people need no further action.
async function pendingLikerCount(userId) {
  const likers = await getLikers(userId);
  // Checked in parallel rather than one await at a time -- with a database
  // backend a sequential loop would be one round-trip per liker.
  //
  // Counts only likers the list will actually show. Without the profile
  // check, someone whose anketa was deleted or hidden still added to "5
  // people liked you" while the list underneath had four -- the same
  // filtering likes.js applies, so the number and the list agree.
  const states = await Promise.all(
    likers.map(async (likerId) => ({
      likedBack: await hasLiked(userId, likerId),
      profile: await getProfile(likerId),
    }))
  );
  return states.filter((s) => !s.likedBack && s.profile?.mediaFileId && s.profile.active !== false).length;
}

// EVERY like gets its own notification -- none are ever dropped. Telegram
// allows roughly one message per second to the same chat and starts returning
// 429 (and eventually throttles the bot itself) past that, so instead of
// skipping messages, notifications for one person are queued and spaced out.
// Someone receiving a burst of likes therefore gets every message, just
// paced; almost always the queue is empty and the message goes out instantly.
const MIN_NOTIFY_GAP_MS = 1100;
const notifyChains = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One promise chain per recipient: messages to different people still go out
// in parallel, only messages to the SAME person are serialised.
function queueNotification(chatKey, task) {
  const prev = notifyChains.get(chatKey) || Promise.resolve();
  const chain = prev
    .then(task)
    .catch((err) => {
      // Blocked the bot, deleted their account, etc. -- the like itself is
      // already recorded, so it simply shows up in their list later.
      console.error("new-like notification failed:", err.message);
    })
    .then(() => sleep(MIN_NOTIFY_GAP_MS));

  notifyChains.set(chatKey, chain);
  // Drop the entry once this chain is the last one still pending, so the map
  // doesn't grow forever as people come and go.
  chain.finally(() => {
    if (notifyChains.get(chatKey) === chain) notifyChains.delete(chatKey);
  });
  return chain;
}

async function notifyNewLike(telegram, likedId) {
  return queueNotification(String(likedId), async () => {
    const lang = await getLanguage(likedId) || DEFAULT_LANG;
    // Counted at send time, not queue time, so the number is current even if
    // several likes were waiting ahead of this one.
    const count = await pendingLikerCount(likedId);
    await telegram.sendMessage(
      likedId,
      t(lang, "newLikeNotification")(count),
      Markup.inlineKeyboard([[Markup.button.callback(t(lang, "seeWhoLikedButton"), "likes:show")]])
    );
  });
}

// skipProfileFor: the id of someone who is ALREADY looking at this person's
// card (the likes list edits it in place). Sending them the profile again
// would put a second, identical photo in the chat right under the one they
// just tapped.
async function recordLikeWithMatchNotification(ctx, likerId, likedId, { skipProfileFor } = {}) {
  const alreadyLikedByMe = await hasLiked(likerId, likedId);
  await recordLike(likerId, likedId);
  // A repeat tap on someone already liked is not news -- never re-notify.
  if (alreadyLikedByMe) return;

  // Not mutual (yet): tell the other person they've been liked, so they can
  // come back and decide instead of only finding out if they happen to open
  // the bot on their own.
  if (!(await hasLiked(likedId, likerId))) {
    // Deliberately not awaited: the person doing the liking shouldn't sit
    // waiting on someone else's notification being paced out of a queue.
    notifyNewLike(ctx.telegram, likedId);
    return;
  }

  const me = await getProfile(likerId);
  const them = await getProfile(likedId);
  if (!me || !them) return;

  const myLang = await getLanguage(likerId) || DEFAULT_LANG;
  const theirLang = await getLanguage(likedId) || DEFAULT_LANG;

  const skipLiker = String(skipProfileFor) === String(likerId);
  try {
    await ctx.telegram.sendMessage(
      likerId,
      skipLiker
        ? t(myLang, "matchNotification")(them.name)
        : `${t(myLang, "matchNotification")(them.name)}\n\n${t(myLang, "profileBelowIntro")}`
    );
    if (!skipLiker) await sendProfileToChat(ctx.telegram, likerId, myLang, likedId);
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

// Telegram file ids can stop working (re-uploaded, expired, the account that
// owned them deleted), and an unhandled failure here left the person tapping a
// button with NOTHING coming back -- which reads as a dead bot. Skips past a
// candidate whose media won't send and tries the next one instead; the few
// attempts are bounded so a systemic outage doesn't loop.
const MAX_CANDIDATE_ATTEMPTS = 5;

async function showNextCandidate(ctx, lang, myGender) {
  if (!myGender) return;

  for (let attempt = 0; attempt < MAX_CANDIDATE_ATTEMPTS; attempt++) {
    const candidate = await pickCandidate(ctx.from.id, myGender);
    if (!candidate) {
      await ctx.reply(t(lang, "discoverNoCandidates"), discoverKeyboard(lang));
      return;
    }
    try {
      await sendCandidate(ctx, lang, candidate.id, candidate.profile, discoverKeyboard(lang));
      return;
    } catch (err) {
      console.error(`Candidate ${candidate.id} could not be shown (skipping):`, err.message);
      // pickCandidate has already marked it as shown, so the next pass moves
      // on rather than picking the same broken profile again.
    }
  }

  // Several in a row failed -- say so instead of leaving a silent screen.
  await ctx.reply(t(lang, "discoverTemporaryProblem"), discoverKeyboard(lang));
}

function registerDiscoverHandlers(bot) {
  const discoverLabels = Object.values(STRINGS).map((dict) => dict.menu.discover);
  const backLabels = Object.values(STRINGS).map((dict) => dict.backButton);
  const reportLabels = Object.values(STRINGS).map((dict) => dict.reportUserButton);

  bot.hears(discoverLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    // Says so out loud rather than silently doing nothing -- a tap that
    // produces no response at all just reads as "the bot is broken".
    if (!me?.gender) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    // Shown when a browsing session starts, not on every swipe: it is a rule
    // people need to know once, and repeating it under every card would be
    // noise they stop reading.
    await ctx.reply(t(lang, "mediaProtectedNotice"), { parse_mode: "HTML" });
    await showNextCandidate(ctx, lang, me.gender);
  });

  bot.hears(LIKE, async (ctx) => {
    const state = await getDiscoverState(ctx.from.id);
    if (state?.currentId) {
      await recordLikeWithMatchNotification(ctx, ctx.from.id, state.currentId);
    }
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender);
  });

  bot.hears(DISLIKE, async (ctx) => {
    const state = await getDiscoverState(ctx.from.id);
    if (state?.currentId) {
      await recordDislike(ctx.from.id, state.currentId);
    }
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
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
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    await clearDiscoverState(ctx.from.id);
    await leaveAnonQueueOrChat(ctx.telegram, ctx.from.id);
    if (isRegistered(me)) {
      await sendMainMenu(ctx, lang);
    }
  });

  // Reports whoever is currently on screen. Reading the id from discoverState
  // (rather than putting it on the button) is also what keeps this correct
  // after a restart -- that state is persisted, so the button never ends up
  // pointing at a candidate the person can no longer see.
  bot.hears(reportLabels, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const state = await getDiscoverState(ctx.from.id);
    if (!state?.currentId) {
      await ctx.reply(t(lang, "reportNoCandidate"));
      return;
    }
    await promptForComplaint(ctx, lang, { targetId: state.currentId, source: SOURCE.DISCOVER });
  });

  bot.action("unlock:noop", async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "unlockNotConfigured"));
  });

  // Kept for messages sent before profile reveals became direct (no button) --
  // re-checks access before revealing anything, since a forwarded/stale
  // button could otherwise leak it.
  bot.action(/^unlock:view:(.+)$/, async (ctx) => {
    const candidateId = ctx.match[1];
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    if (!(await canViewProfile(ctx.from.id, candidateId))) {
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

  if (candidateId && (await canViewProfile(buyerId, candidateId))) {
    await revealProfile(ctx, lang, candidateId);
    return;
  }

  const orderId = candidateId ? await createOrder(buyerId, { type: "unlock", targetId: candidateId }) : null;
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
  // Not part of the bot's own surface -- exposed so the candidate picker can
  // be exercised directly against both storage backends.
  __test: { pickCandidate, MAX_SHOWN_MEMORY },
};
