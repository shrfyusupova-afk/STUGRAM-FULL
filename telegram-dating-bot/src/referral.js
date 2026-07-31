// "Invite friends, unlock profiles for free."
//
// The whole feature is one trade: bring REFERRALS_PER_CREDIT people who
// actually finish their anketa, and get one free profile unlock. Everything
// below exists to make that trade honest in both directions -- the person
// really gets the credit, and nobody can manufacture credits out of nothing.
//
// The abuse the design has to survive is obvious and cheap to attempt: make
// throwaway accounts, click your own link, collect. So the reward is NOT paid
// when the link is clicked. It is paid only when the invited person has filled
// in a complete anketa -- name, age, gender, photo, location, bio and a
// verified phone number. That is a real phone per credit, which is the only
// barrier here that actually costs an attacker something.
const { Markup } = require("telegraf");
const {
  getProfile,
  createReferral,
  getReferral,
  markReferralRewarded,
  countReferrals,
  getUnlockCredits,
  addUnlockCredits,
} = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { getUsername } = require("./botInfo");
const { isRegistered } = require("./profileState");

// Three friends, one free unlock.
const REFERRALS_PER_CREDIT = 3;

// One person can bring in at most this many rewarded invites per day. Well
// above anything a real person does by sharing a link with friends, and low
// enough that a script farming accounts stops being worth the phone numbers.
const DAILY_REFERRAL_CAP = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const REFERRAL_PREFIX = "ref_";

// The deep link is the "code". Telegram resolves ?start=<payload> into
// ctx.startPayload, so there is nothing for the invited person to type or
// paste -- they tap, and the bot already knows who sent them.
function referralLink(userId) {
  const botUsername = getUsername();
  if (!botUsername) return null;
  return `https://t.me/${botUsername}?start=${REFERRAL_PREFIX}${userId}`;
}

// Reads the referrer out of a /start payload. Returns null for anything that
// is not exactly this feature's payload, so an unrelated deep link can never
// be mistaken for one.
function referrerFromPayload(payload) {
  if (typeof payload !== "string" || !payload.startsWith(REFERRAL_PREFIX)) return null;
  const id = payload.slice(REFERRAL_PREFIX.length);
  // Telegram ids are digits. Anything else was hand-crafted, and letting it
  // through would put an arbitrary attacker-chosen string into the database.
  if (!/^\d{1,20}$/.test(id)) return null;
  return id;
}

// Records "this person arrived through that person's link", pending. Returns a
// reason string rather than throwing, because every rejection here is an
// ordinary outcome (someone clicking their own link, an existing user opening
// a friend's link) rather than an error.
//
// Nothing is paid out at this point. See rewardIfEarned.
async function registerReferralClick(referrerId, referredId) {
  const referrer = String(referrerId);
  const referred = String(referredId);

  // Clicking your own link. The single most obvious way to try to farm this.
  if (referrer === referred) return "self";

  // An invite from somebody who does not exist cannot be credited to anyone.
  const referrerProfile = await getProfile(referrer);
  if (!isRegistered(referrerProfile)) return "unknown_referrer";

  // Already a user. Opening a friend's link later is fine and normal -- it
  // just is not an invitation, and paying for it would let two existing users
  // farm each other.
  const referredProfile = await getProfile(referred);
  if (referredProfile) return "existing_user";

  // The database decides whether this is the first time, not a prior SELECT:
  // referred_id is a primary key, so a second row is refused outright. That
  // is also what makes deleting the account and rejoining pointless.
  const created = await createReferral(referrer, referred);
  return created ? "recorded" : "already_referred";
}

// Called when someone FINISHES their anketa -- the only moment an invitation
// becomes worth anything.
//
// Must be safe to call more than once for the same person: finish() also runs
// when an existing user edits their profile. markReferralRewarded returning
// true for exactly one caller is what guarantees a single payout per invitee.
//
// Returns null when nothing happened, or a summary the caller can use to tell
// the referrer.
async function rewardIfEarned(referredId) {
  const referral = await getReferral(referredId);
  if (!referral || referral.rewarded) return null;

  const referrerId = String(referral.referrerId);

  // Claim this invitee first. Whoever wins this call owns the payout; a
  // concurrent or repeated call sees false and stops here.
  const claimed = await markReferralRewarded(referredId);
  if (!claimed) return null;

  // The cap is checked AFTER claiming so a capped invite is consumed rather
  // than left pending to be paid the moment the window rolls over. A burst of
  // sign-ups past the cap therefore earns nothing at all, which is the point.
  const sinceIso = new Date(Date.now() - DAY_MS).toISOString();
  const todayCount = await countReferrals(referrerId, { sinceIso });
  if (todayCount > DAILY_REFERRAL_CAP) {
    console.warn(
      `Referral cap hit: ${referrerId} has ${todayCount} invites in 24h (cap ${DAILY_REFERRAL_CAP}) -- no reward for ${referredId}`
    );
    return { referrerId, capped: true, total: 0, creditGranted: false, credits: 0 };
  }

  const total = await countReferrals(referrerId, { rewardedOnly: true });
  const creditGranted = total % REFERRALS_PER_CREDIT === 0;
  const credits = creditGranted ? await addUnlockCredits(referrerId, 1) : await getUnlockCredits(referrerId);

  return { referrerId, capped: false, total, creditGranted, credits };
}

// Tells the referrer what just happened -- either "one step closer" or "you
// earned a free unlock". Sent through the MAIN bot, and failure to deliver is
// never allowed to break the invited person's registration: they did nothing
// wrong and their anketa is already saved by this point.
async function notifyReferrer(telegram, outcome, langOf) {
  if (!outcome || outcome.capped) return;
  try {
    const lang = (await langOf(outcome.referrerId)) || DEFAULT_LANG;
    // Not a multiple of REFERRALS_PER_CREDIT here -- when it is, creditGranted
    // is already true and takes the branch above instead.
    const have = outcome.total % REFERRALS_PER_CREDIT;
    const text = outcome.creditGranted
      ? t(lang, "referralCreditEarned")(REFERRALS_PER_CREDIT, outcome.credits)
      // A credit already sitting unspent from an earlier cycle is worth
      // repeating on every progress update, not just the moment it was
      // earned -- otherwise it is easy to forget you have a free unlock
      // waiting and never come back to spend it.
      : outcome.credits > 0
        ? t(lang, "referralProgressWithCredits")(have, REFERRALS_PER_CREDIT, outcome.credits)
        : t(lang, "referralProgress")(have, REFERRALS_PER_CREDIT);
    await telegram.sendMessage(outcome.referrerId, text, { parse_mode: "HTML" });
  } catch (err) {
    // Blocked the bot, deleted their account, network blip -- none of it is
    // the new user's problem.
    console.error("referral notification failed (ignored):", err.message);
  }
}

// How many more invites until the next free unlock.
function invitesUntilNextCredit(rewardedTotal) {
  const remainder = rewardedTotal % REFERRALS_PER_CREDIT;
  return REFERRALS_PER_CREDIT - remainder;
}

async function buildReferralScreen(userId, lang) {
  const link = referralLink(userId);
  const invited = await countReferrals(userId, { rewardedOnly: true });
  const credits = await getUnlockCredits(userId);

  if (!link) {
    // Long-polling locally with no getMe result yet: say so instead of
    // printing a broken half-link.
    return { text: t(lang, "referralLinkUnavailable"), keyboard: null };
  }

  return {
    text: t(lang, "referralScreen")({
      link,
      invited,
      credits,
      perCredit: REFERRALS_PER_CREDIT,
      remaining: invitesUntilNextCredit(invited),
    }),
    // A share button, so passing the link on is one tap rather than a
    // copy-paste. Telegram fills the message in for them.
    keyboard: Markup.inlineKeyboard([
      [Markup.button.url(t(lang, "referralShareButton"), `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t(lang, "referralShareText"))}`)],
    ]),
  };
}

async function sendReferralScreen(ctx, lang) {
  const screen = await buildReferralScreen(ctx.from.id, lang);
  await ctx.reply(screen.text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(screen.keyboard || {}),
  });
}

function registerReferralHandlers(bot) {
  const labels = Object.values(STRINGS).map((dict) => dict.menu.referral);
  const { getLanguage } = require("./db");

  bot.hears(labels, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await sendReferralScreen(ctx, lang);
  });

  // Reached from the unlock paywall's "invite friends instead" button, so
  // somebody who cannot afford a profile has the free route one tap away
  // rather than having to find the menu.
  bot.action("referral:show", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await ctx.answerCbQuery().catch(() => {});
    await sendReferralScreen(ctx, lang);
  });
}

module.exports = {
  REFERRALS_PER_CREDIT,
  DAILY_REFERRAL_CAP,
  referralLink,
  referrerFromPayload,
  registerReferralClick,
  rewardIfEarned,
  notifyReferrer,
  invitesUntilNextCredit,
  buildReferralScreen,
  sendReferralScreen,
  registerReferralHandlers,
};
