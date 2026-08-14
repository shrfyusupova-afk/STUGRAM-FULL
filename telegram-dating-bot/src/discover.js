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
  grantUnlock,
  getUnlockCredits,
  consumeUnlockCredit,
  getLikeNoticeAt,
  setLikeNoticeAt,
  countPendingLikers,
  hasPremium,
  recordDislike,
  getDislikes,
  getMyLikes,
  getDiscoverState,
  setDiscoverState,
  clearDiscoverState,
} = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { getUsername } = require("./botInfo");
const { sendMainMenu, mainMenuKeyboard } = require("./menu");
const { UNLOCK_PRICE_SOM } = require("./orders");
const { buildPaymentOptions, withPaymentNote } = require("./checkout");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { leaveAnonQueueOrChat } = require("./anonChat");
const { promptForComplaint, SOURCE } = require("./complaints");
const { profileLinkHref } = require("./profileLink");
const { REFERRALS_PER_CREDIT } = require("./referral");
const { isRegistered } = require("./profileState");
const { locationWithDistance } = require("./geo");
const { passesGate } = require("./channelGate");

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
  // A like/dislike is a terminal, one-time reaction to a card: once given,
  // that candidate must never come back -- including once the "shown"
  // recycle branch below discards its own memory. Before this, `pool` only
  // excluded dislikes, so a liked profile was kept out solely by the
  // ephemeral `shown` list, and reappeared the moment that list got reset.
  const liked = new Set(await getMyLikes(userId));
  const pool = Object.entries(all).filter(
    ([id, p]) =>
      id !== String(userId) &&
      p.gender === wanted &&
      p.mediaFileId &&
      p.phone &&
      p.active !== false &&
      !disliked.has(id) &&
      !liked.has(id)
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
//
// viewerLocation turns the location line into "Mirobod (7.5 km)" -- the
// distance is the single most useful thing about a stranger's location, and
// it can only be worked out relative to whoever is looking. Omitting it (as
// the self-view does, where "how far are you from yourself" is meaningless)
// simply falls back to the plain place name.
function buildProfileCaption(
  lang,
  candidateId,
  profile,
  { includeUnlock = true, contactPhone, viewerLocation } = {}
) {
  const locationLine = viewerLocation
    ? locationWithDistance(profile.location, viewerLocation, { nearText: t(lang, "distanceNear") })
    : profile.location;

  const base =
    `👤 <b>${escapeHtml(profile.name)}</b>, ${profile.age}\n` +
    `📍 ${escapeHtml(locationLine)}\n\n` +
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
  const unlockLabel = escapeHtml(t(lang, "unlockLinkText"));
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
// Access is a recorded fact, not something re-derived from the likes table.
//
// It used to include "we liked each other", which handed the contact to BOTH
// sides of a match. It no longer does: on a match the person who liked FIRST
// is granted an unlock row, and that row is what this reads. Deriving it from
// mutual likes cannot express that, because neither backend records which
// like came first -- but the code that forms the match knows, so it writes
// the answer down at that moment instead.
async function canViewProfile(viewerId, candidateId) {
  return (await hasUnlocked(viewerId, candidateId)) || (await hasPremium(viewerId));
}

// Sends a candidate's profile straight to an arbitrary chat (not necessarily
// the current ctx's chat) with the contact phone already revealed -- no
// "View profile" button/tap in between. Used to show both sides of a match
// their new profile immediately, right under the "matched!" text.
async function sendProfileToChat(telegram, chatId, lang, candidateId) {
  const candidate = await getProfile(candidateId);
  if (!candidate) return;
  // chatId IS the person about to look at this card, so their own location is
  // what the distance is measured from. One extra read, on a path that runs
  // once per match -- not per swipe.
  const viewer = await getProfile(chatId);
  const caption = buildProfileCaption(lang, candidateId, candidate, {
    includeUnlock: false,
    contactPhone: candidate.phone,
    viewerLocation: viewer?.location,
  });
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
  const viewer = await getProfile(ctx.from.id);
  await sendCandidate(ctx, lang, candidateId, candidate, undefined, {
    includeUnlock: false,
    contactPhone: candidate.phone,
    viewerLocation: viewer?.location,
  });
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
// One query on Postgres. The old shape -- fetch the likers, then two more
// queries per liker -- cost 1001 round trips for a profile with 500 admirers,
// against a five-connection pool, on every like received and once per person
// in a win-back sweep. A single sweep could therefore fire tens of thousands
// of queries and stall every real user waiting behind them.
async function pendingLikerCount(userId) {
  return countPendingLikers(userId);
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
// The chain serialises everything for one chat, which is what makes the
// milestone decision safe: two likes landing together cannot both read the
// old marker and both announce.
//
// The pace is only paid when something was actually SENT. Most runs through
// here now send nothing (a like below the next milestone), and sleeping over
// those would push the one message that does matter behind a second of dead
// waiting per silent like -- with three quick likes, the announcement at
// three would arrive more than two seconds late for no reason.
function queueNotification(chatKey, task) {
  const prev = notifyChains.get(chatKey) || Promise.resolve();
  const chain = prev
    .then(task)
    .catch((err) => {
      // Blocked the bot, deleted their account, etc. -- the like itself is
      // already recorded, so it simply shows up in their list later.
      console.error("new-like notification failed:", err.message);
      return false;
    })
    .then((sent) => (sent ? sleep(MIN_NOTIFY_GAP_MS) : undefined));

  notifyChains.set(chatKey, chain);
  // Drop the entry once this chain is the last one still pending, so the map
  // doesn't grow forever as people come and go.
  chain.finally(() => {
    if (notifyChains.get(chatKey) === chain) notifyChains.delete(chatKey);
  });
  return chain;
}

// A message per like is how a bot gets muted. People are told every third
// like instead -- 3, 6, 9, 12 and on -- so each message is a real reason to
// come back ("three more people are waiting") rather than a nudge about one
// stranger.
const LIKE_MILESTONE_STEP = 3;

// The largest milestone this count has reached, or 0 below the first one.
function milestoneFor(count) {
  return Math.floor(count / LIKE_MILESTONE_STEP) * LIKE_MILESTONE_STEP;
}

// Announces a milestone at most once per crossing.
//
// The stored marker moves DOWN as well as up. Somebody who works through
// their likes drops back under a milestone, and when new likes push them over
// it again that is fresh news worth a message -- but only then, not on every
// like in between. Without the downward move a person would be told once and
// never again for the rest of their time on the bot.
async function notifyNewLike(telegram, likedId) {
  return queueNotification(String(likedId), async () => {
    // Counted at send time, not queue time, so the number is current even if
    // several likes were waiting ahead of this one.
    const count = await pendingLikerCount(likedId);
    const reached = milestoneFor(count);
    const announced = await getLikeNoticeAt(likedId);

    // "Why didn't I get a message when three people liked me?" is otherwise
    // unanswerable after the fact: the count here is not "how many likes" but
    // "how many likers still WAITING on an answer", so somebody who already
    // liked those three back has a pending count of zero and correctly hears
    // nothing. Logging the numbers turns that from a mystery into a lookup.
    console.log(
      `like milestone for ${likedId}: pending=${count} reached=${reached} announced=${announced}`
    );

    if (reached === announced) return false;

    if (reached < announced) {
      // They have responded to some; re-arm without saying anything.
      await setLikeNoticeAt(likedId, reached);
      return false;
    }

    await setLikeNoticeAt(likedId, reached);
    const lang = (await getLanguage(likedId)) || DEFAULT_LANG;
    await telegram.sendMessage(
      likedId,
      t(lang, "likeMilestoneNotification")(count),
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, "seeWhoLikedButton"), "likes:show")]]),
      }
    );
    return true;
  });
}

// The old skipProfileFor option is gone with the change above: the person who
// answers a like is no longer sent a profile card at all, so there is no
// longer a duplicate to suppress.
async function recordLikeWithMatchNotification(ctx, likerId, likedId) {
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

  // A match. Note who is who: likedId had ALREADY liked, which is the only
  // reason this is a match at all, so likedId liked FIRST and likerId is the
  // one who just answered.
  //
  // Only the first liker is given the contact. They took the risk of liking a
  // stranger with nothing in return; the reward for that is the connection.
  // The one answering already knows somebody is interested -- they saw it in
  // their likes list -- so for them the contact is worth paying for.
  const me = await getProfile(likerId);
  const them = await getProfile(likedId);
  if (!me || !them) return;

  const myLang = (await getLanguage(likerId)) || DEFAULT_LANG;
  const theirLang = (await getLanguage(likedId)) || DEFAULT_LANG;

  // Written down rather than inferred later: canViewProfile reads this row,
  // and nothing in either backend records which like came first.
  await grantUnlock(likedId, likerId);

  // The first liker: told, and given the contact.
  try {
    await ctx.telegram.sendMessage(
      likedId,
      `${t(theirLang, "matchNotification")(me.name)}\n\n${t(theirLang, "profileBelowIntro")}`
    );
    await sendProfileToChat(ctx.telegram, likedId, theirLang, likerId);
  } catch (err) {
    console.error("match notification (first liker) failed:", err.message);
  }

  // The one who answered: told what happened and what it means, honestly --
  // the other person has their contact and can write first. Then the usual
  // unlock screen, which already offers the free routes as well as the price.
  try {
    await ctx.reply(t(myLang, "matchNotificationLocked")(them.name), { parse_mode: "HTML" });
    await handleUnlockDeepLink(ctx, myLang, String(likedId));
  } catch (err) {
    console.error("match notification (responder) failed:", err.message);
  }
}

// Telegram file ids can stop working (re-uploaded, expired, the account that
// owned them deleted), and an unhandled failure here left the person tapping a
// button with NOTHING coming back -- which reads as a dead bot. Skips past a
// candidate whose media won't send and tries the next one instead; the few
// attempts are bounded so a systemic outage doesn't loop.
const MAX_CANDIDATE_ATTEMPTS = 5;

// viewerLocation is what turns each card's location line into a distance.
// Every caller already has the viewer's profile loaded to read `gender` off
// it, so passing the location too costs nothing extra -- no second lookup on
// the swipe path, which is the hottest one in the app.
async function showNextCandidate(ctx, lang, myGender, viewerLocation) {
  if (!myGender) return;

  for (let attempt = 0; attempt < MAX_CANDIDATE_ATTEMPTS; attempt++) {
    const candidate = await pickCandidate(ctx.from.id, myGender);
    if (!candidate) {
      // Not discoverKeyboard: with nobody on screen, a Like/Dislike row that
      // does nothing is confusing. The main menu puts the referral button
      // (what the message itself is pointing at) one tap away instead of
      // buried behind "Orqaga".
      await ctx.reply(t(lang, "discoverNoCandidates"), mainMenuKeyboard(lang));
      return;
    }
    try {
      await sendCandidate(ctx, lang, candidate.id, candidate.profile, discoverKeyboard(lang), { viewerLocation });
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


// The one way into browsing, so the menu button and the win-back message's
// "see profiles" button land on exactly the same screen rather than drifting
// into two versions of it.
async function openDiscovery(ctx) {
  const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
  const me = await getProfile(ctx.from.id);
  // Says so out loud rather than silently doing nothing -- a tap that
  // produces no response at all just reads as "the bot is broken".
  if (!me?.gender) {
    await ctx.reply(t(lang, "noProfileYet"));
    return;
  }
  // No "your photos are protected" preamble here: protect_content already
  // enforces it silently on every card (see PROTECTED), and an explanatory
  // wall of text between tapping "browse" and seeing the first person just
  // delays the thing they asked for.
  await showNextCandidate(ctx, lang, me.gender, me.location);
}

function registerDiscoverHandlers(bot) {
  const discoverLabels = Object.values(STRINGS).map((dict) => dict.menu.discover);
  const backLabels = Object.values(STRINGS).map((dict) => dict.backButton);
  const reportLabels = Object.values(STRINGS).map((dict) => dict.reportUserButton);

  bot.hears(discoverLabels, openDiscovery);

  bot.hears(LIKE, async (ctx) => {
    const state = await getDiscoverState(ctx.from.id);
    if (state?.currentId) {
      await recordLikeWithMatchNotification(ctx, ctx.from.id, state.currentId);
    }
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;

    // The like itself is ALWAYS recorded above before the gate is consulted:
    // asking somebody to subscribe must never cost them the decision they
    // just made. The gate only stands between them and the NEXT profile, and
    // only until they subscribe -- after that it never appears again.
    if (!(await passesGate(ctx, lang, "discover"))) return;

    const me = await getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender, me?.location);
  });

  bot.hears(DISLIKE, async (ctx) => {
    const state = await getDiscoverState(ctx.from.id);
    if (state?.currentId) {
      await recordDislike(ctx.from.id, state.currentId);
    }
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    await showNextCandidate(ctx, lang, me?.gender, me?.location);
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

  // Spending a referral credit on this profile.
  //
  // The order of operations here is the whole point. A person can tap this
  // button twice before the first reply lands, and an old message keeps its
  // buttons forever, so this must be safe to run repeatedly:
  //
  //   1. free already? -> reveal, spend NOTHING. Covers the case where they
  //      matched, bought Premium, or already unlocked this person since the
  //      paywall was drawn -- charging a credit there would be theft.
  //   2. take the credit FIRST, and only act if the take succeeded.
  //      consumeUnlockCredit does the check and the decrement in one
  //      statement, so of two simultaneous taps exactly one gets a credit.
  //   3. record the unlock, then reveal. Recording before revealing means a
  //      failure to send the card still leaves them owning the profile --
  //      they paid for it, and they can open it again from the same link.
  bot.action(/^unlock:credit:(.+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const candidateId = String(ctx.match[1]);
    const buyerId = ctx.from.id;
    await safeAnswerCbQuery(ctx);

    if (await canViewProfile(buyerId, candidateId)) {
      await revealProfile(ctx, lang, candidateId);
      return;
    }

    const candidate = await getProfile(candidateId);
    if (!isRegistered(candidate) || candidate.active === false) {
      await ctx.reply(t(lang, "profileUnavailable"));
      return;
    }

    if (!(await consumeUnlockCredit(buyerId))) {
      // Nothing left -- either they spent it in another chat window or the
      // button belongs to an old message. Re-draw the paywall rather than
      // leaving them looking at a button that did nothing.
      await ctx.reply(t(lang, "unlockCreditGone"));
      await handleUnlockDeepLink(ctx, lang, candidateId);
      return;
    }

    await grantUnlock(buyerId, candidateId);
    const left = await getUnlockCredits(buyerId);
    await ctx.reply(t(lang, "unlockCreditUsed")(left), { parse_mode: "HTML" });
    await revealProfile(ctx, lang, candidateId);
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

// Reached via the unlock link inside a candidate's card, which deep-links
// back into the bot as /start unlock_<candidateId>. If the viewer already has
// access (paid before, or a mutual like happened since), this skips the
// paywall entirely and shows the profile straight away.
// The card's own link is deliberately vague (see unlockLinkText) -- the price
// only appears once someone actually gets here, on the paywall text below.
const priceLabel = () => UNLOCK_PRICE_SOM.toLocaleString("uz-UZ");

// The paywall. Three different screens depending on what this person can
// already do, because "pay up" is the wrong thing to say to someone who has
// earned a free unlock and to someone who has no idea a free route exists.
async function handleUnlockDeepLink(ctx, lang, candidateId) {
  const buyerId = ctx.from.id;

  // Already theirs: paid before, has Premium, or the two of them matched
  // since. Nothing to sell, and nothing to spend.
  if (candidateId && (await canViewProfile(buyerId, candidateId))) {
    await revealProfile(ctx, lang, candidateId);
    return;
  }

  // One row per configured provider. Whichever the person picks settles the
  // same single order, so paying with either grants exactly the same thing.
  const payment = candidateId
    ? await buildPaymentOptions(buyerId, { type: "unlock", targetId: candidateId, amountSom: UNLOCK_PRICE_SOM, lang, t })
    : { options: [], configured: false, rows: [], note: "" };
  const payRows = payment.configured
    ? payment.rows
    : [[Markup.button.callback(t(lang, "payButtonGeneric"), "payments:noop")]];

  const credits = await getUnlockCredits(buyerId);

  if (credits > 0 && candidateId) {
    await ctx.reply(withPaymentNote(t(lang, "unlockPaywallWithCredits")({ price: priceLabel(), credits }), payment.note), {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        ...payRows,
        [Markup.button.callback(t(lang, "unlockUseCreditButton")(credits), `unlock:credit:${candidateId}`)],
      ]),
    });
    return;
  }

  // No credits: say what the two free routes are instead of only naming a
  // price. Waiting for a like back costs nothing and already works; inviting
  // friends is the route this screen can actually start.
  await ctx.reply(
    withPaymentNote(
      t(lang, "unlockPaywallNoCredits")({ price: priceLabel(), perCredit: REFERRALS_PER_CREDIT }),
      payment.note
    ),
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        ...payRows,
        [Markup.button.callback(t(lang, "unlockInviteFriendsButton"), "referral:show")],
      ]),
    }
  );
}

module.exports = {
  registerDiscoverHandlers,
  handleUnlockDeepLink,
  sendCandidate,
  sendProfileToChat,
  buildProfileCaption,
  canViewProfile,
  recordLikeWithMatchNotification,
  openDiscovery,
  // Exported so likes.js asks the SAME question about access rather than
  // re-deriving it from mutual likes -- which is what quietly handed the
  // contact to both sides of a match.
  canViewProfile,
  // Shared with the mini app so the "how many people liked you" number it
  // shows is the same one the bot's own notification counts, not a second
  // implementation that could drift.
  pendingLikerCount,
  // Not part of the bot's own surface -- exposed so the candidate picker can
  // be exercised directly against both storage backends.
  __test: {
    pickCandidate,
    MAX_SHOWN_MEMORY,
    milestoneFor,
    LIKE_MILESTONE_STEP,
    // Notifications are paced, so they finish AFTER the update that caused
    // them. A test that asserts on them has to wait for the queue rather than
    // guess at a delay -- guessing is how a suite ends up passing because it
    // looked too early.
    pendingNotifications: () => Promise.all([...notifyChains.values()]),
  },
};
