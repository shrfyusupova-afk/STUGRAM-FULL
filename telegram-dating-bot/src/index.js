require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const { Telegraf, Scenes, Markup, session } = require("telegraf");
const { profileWizard } = require("./scenes/profileWizard");
const { registerMenuHandlers, sendMainMenu } = require("./menu");
const { registerDiscoverHandlers, handleUnlockDeepLink, openDiscovery } = require("./discover");
const { registerLikesHandlers } = require("./likes");
const { registerProfileSettingsHandlers } = require("./profileSettings");
const { registerPremiumHandlers } = require("./premium");
const { registerVipChatHandlers } = require("./vipChat");
const { registerAnonChatHandlers, leaveAnonQueueOrChat, anonSubmenuKeyboard, attemptJoin } = require("./anonChat");
const { registerComplaintHandlers } = require("./complaints");
const { registerForStatisticHandlers, BOARD_LIMIT: FS_BOARD_LIMIT } = require("./forStatistic");
const { registerAccountNoticeHandlers } = require("./accountNotices");
const { registerMiniApp } = require("./miniApp");
const {
  referrerFromPayload,
  registerReferralClick,
  registerReferralHandlers,
} = require("./referral");
const { startWinbackSweeper, registerWinbackHandlers } = require("./winback");
const { startPremiumReminders } = require("./premiumReminder");
const { safeAnswerCbQuery, isGoneError } = require("./telegramSafety");
const { isRegistered } = require("./profileState");
const { floodGuardMiddleware } = require("./floodGuard");
const { registerClickRoutes, clickConfigProblem, retryUndeliveredOrders, extendFrom, PREMIUM_DAYS, ANON_GENDER_DAYS } = require("./click");
const {
  registerPaymeRoutes,
  isTestCheckout: paymeCheckoutIsTest,
  isConfigured: paymeConfigured,
  ACCOUNT_FIELD: PAYME_ACCOUNT_FIELD,
} = require("./payme");
const paymeAccountField = () => PAYME_ACCOUNT_FIELD;
const { registerChannelGate, startChannelProbe, channelGateStatus } = require("./channelGate");
const { vipInviteLink, probeVipChat, vipInviteStatus } = require("./vipInvite");
const { registerChatIdReporter } = require("./chatIdReporter");
const { registerCheckoutHandlers } = require("./checkout");
const { createAdminBot } = require("./adminBot");
const { alert, configureAlerts, ALERT_CHAT_ID } = require("./alerts");
const {
  getProfile, getLanguage, setLanguage, setPremiumUntil, setAnonGenderFilterUntil,
  grantUnlock, grantVipChat, setTelegramUsername, initStorage, closeStorage, usePostgres,
  backfillMatchUnlocks, touchLastSeen, markBotBlocked,
  addAdAmount, listTopAds,
} = require("./db");
const { LANGUAGES, DEFAULT_LANG, t } = require("./i18n");
const { setUsername, setPublicUrl } = require("./botInfo");
const { sendPolicyDocument, renderPolicyHtml } = require("./policy");

// Registered before anything else so it also covers startup.
//
// On Node 15+ a single unhandled promise rejection terminates the process by
// default -- one failed sendMessage inside a timer or a fire-and-forget
// notification would take the whole bot down until the host restarted it.
// For a bot whose entire job is to stay reachable that trade is backwards,
// especially where a restart means a cold start and minutes of downtime.
//
// Continuing is safe for a REJECTION specifically because this app keeps no
// long-lived in-memory state that could be left half-updated: everything
// persistent is read per operation and written atomically, and the only
// in-memory state (anon-chat queues) is deliberately disposable. A failed
// sendMessage in a timer is not a reason to drop every user's session.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (bot kept running):", reason);
});

// An uncaught EXCEPTION is a different thing, and this used to keep running
// through one too. It should not.
//
// After an uncaught exception the process is in a state nobody reasoned
// about: a handler stopped halfway, whatever it was holding is half-written,
// and every later update is served by that. The result is a service that
// answers /health with "ok" and quietly does the wrong thing -- which is
// worse than a crash, because a crash is visible and Render restarts it
// within seconds, while a zombie is restarted by nobody.
//
// So: say what happened, then die, and let the platform bring back a process
// whose state is known. The exit code is non-zero so the restart is recorded
// as a failure rather than a clean shutdown.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception -- exiting so the platform restarts a clean process:", err);
  // Best-effort, capped at 2s: this process is dying either way, and the
  // send racing against a hard timeout inside alert() means a slow or
  // hanging Telegram API call cannot delay the exit -- a zombie process is
  // exactly the outcome the exit below exists to avoid.
  alert(`Bot crashed and is restarting:\n${err.stack || err.message}`, { bypassThrottle: true, timeoutMs: 2000 })
    .catch(() => {})
    .finally(() => process.exit(1));
});

// Off unless explicitly switched on. See the note at setChatMenuButton below
// for why disabling it also has to put the Telegram menu button back.
const MINI_APP_ENABLED = process.env.MINI_APP_ENABLED === "true";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// Creates the schema (and, the first time only, imports whatever the old JSON
// files still hold) before any update is served, so a message arriving during
// startup can't hit a table that doesn't exist yet. A failure here is fatal on
// purpose: running on a database that isn't ready would silently lose writes,
// which is exactly what moving off the JSON files was meant to stop.
async function prepareStorage() {
  await initStorage();

  // Pairs that matched BEFORE the contact stopped being granted to both sides
  // already had each other's number. Taking it back retroactively would mean
  // the app removing something a person was given, so their access is written
  // down explicitly instead. Idempotent, and a no-op after the first run.
  try {
    const granted = await backfillMatchUnlocks();
    if (granted) console.log(`Backfilled ${granted} pre-existing match unlock(s).`);
  } catch (err) {
    console.error("match unlock backfill failed (continuing):", err.message);
  }

  if (!usePostgres) return;
  try {
    const { migrateJsonToPg } = require("./storage/migrateJsonToPg");
    const result = await migrateJsonToPg(require("./storage/pgStore"));
    if (result.skipped) console.log(`Migration: nothing to do (${result.reason}).`);
    else console.log("Migration: imported from JSON ->", result.counts);
  } catch (err) {
    // The schema is up; only the one-time import failed. Worth shouting about
    // but not worth refusing to start, since new users can already be served.
    console.error("Migration from JSON failed (continuing):", err);
  }
}

// Render (and most PaaS hosts) inject the public HTTPS URL for a web service
// automatically; WEBHOOK_DOMAIN is an escape hatch for hosts that don't.
// When neither is set (e.g. running on a laptop with no public URL) we fall
// back to long-polling so local development still works without ngrok.
const webhookDomain = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_DOMAIN;
const webhookPath = "/telegram/webhook";
// This path is a fixed constant (visible in this very file on GitHub) --
// without a secret token, Telegraf accepts ANY request that hits it, which
// would let anyone who knows the domain forge fake Telegram updates (fake
// messages, fake button taps, impersonating any user). Auto-generate one if
// the operator forgot to set TELEGRAM_WEBHOOK_SECRET, so the bot is never
// accidentally left wide open -- the app re-registers its own webhook with
// whichever value it picks on every boot, so there's no need for this to
// stay stable across restarts.
//
// Telegram accepts ONLY A-Z a-z 0-9 _ - in secret_token. Anything else and
// setWebhook fails with "Bad Request: secret token contains unallowed
// characters" -- forever, on every boot, with the bot silently receiving
// nothing at all. This is not hypothetical: Render's `generateValue: true`
// hands out base64, which contains + / and =, and that alone kept a live
// deployment deaf until the API error was read directly. So never pass an
// operator-supplied value through untouched: if it doesn't conform, hash it
// into something that does. Hashing (rather than generating a fresh random)
// keeps the value stable across restarts, so a webhook registered by an
// older instance still validates against a newer one.
// Reported on /health so a restart is visible as a moving timestamp -- a
// process that keeps crashing and coming back looks identical to a healthy
// one otherwise.
const STARTED_AT = new Date().toISOString();

const SECRET_TOKEN_OK = /^[A-Za-z0-9_-]{1,256}$/;
function usableWebhookSecret(raw, envName) {
  if (!raw) return crypto.randomBytes(32).toString("hex");
  if (SECRET_TOKEN_OK.test(raw)) return raw;
  console.warn(
    `${envName} contains characters Telegram does not allow in secret_token ` +
      "(only A-Z a-z 0-9 _ - are permitted) -- using a hash of it instead. " +
      "The value still works; set a conforming one to silence this warning."
  );
  return crypto.createHash("sha256").update(raw).digest("hex");
}

let webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (webhookDomain) {
  if (!webhookSecret) {
    console.warn(
      "TELEGRAM_WEBHOOK_SECRET was not set -- auto-generated a random one for this run. " +
        "Set it explicitly in your environment to silence this warning."
    );
  }
  webhookSecret = usableWebhookSecret(webhookSecret, "TELEGRAM_WEBHOOK_SECRET");
}
const port = process.env.PORT || 3000;

// Lets the wizard's confirmation step link straight to a real page
// (GET /policy below) instead of a deep link back into the chat, whenever a
// public HTTPS domain actually exists.
setPublicUrl(webhookDomain);

// The admin bot is optional -- runs in this same process/service so it
// shares the exact same data/ files as the main bot (no sync, no
// duplication, no risk of losing account data across two separate deploys).
const adminToken = process.env.ADMIN_BOT_TOKEN;
// The main bot is constructed first because the admin bot needs its Telegram
// client: a reply to a complaint must be delivered to the reporter through
// the bot they actually use, not through the admin bot.
const bot = new Telegraf(token);
const adminBot = adminToken ? createAdminBot(adminToken, bot.telegram) : null;

// The admin bot's client when there is one -- an alert landing in the same
// place as the rest of the operator's tools makes more sense than it arriving
// as an unrelated message in the dating bot real users are also in. Falls
// back to the main bot's client so alerts still work for anyone who has not
// set up the admin bot at all.
configureAlerts((adminBot || bot).telegram);

const adminWebhookPath = "/telegram/admin-webhook";
let adminWebhookSecret = process.env.ADMIN_WEBHOOK_SECRET;
if (adminBot && webhookDomain) {
  if (!adminWebhookSecret) {
    console.warn(
      "ADMIN_WEBHOOK_SECRET was not set -- auto-generated a random one for this run. " +
        "Set it explicitly in your environment to silence this warning."
    );
  }
  adminWebhookSecret = usableWebhookSecret(adminWebhookSecret, "ADMIN_WEBHOOK_SECRET");
}

const stage = new Scenes.Stage([profileWizard]);

// First of all, before session/stage/anything else does any work: a flood
// from one user is cheapest to stop before a single handler runs.
bot.use(floodGuardMiddleware);

bot.use(session());

// Records the person's Telegram @username as they use the bot. It is what
// makes a working "open this profile" link possible: tg://user only resolves
// for people the viewing client already knows, whereas t.me/<username> always
// opens. Handles change, so this refreshes rather than writing once.
//
// Deliberately fire-and-forget and never awaited: this is a side note, and an
// update must not be delayed (or dropped) because a bookkeeping write was
// slow or failed.
const lastSeenUsername = new Map();
const lastSeenTouch = new Map();
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

// Both maps above gain an entry per person and nothing removed them, so they
// grew for the lifetime of the process -- one entry per user who ever sent a
// message, held forever, on a 512 MB instance. Dropping an entry costs
// nothing: the worst case is one extra username write or one extra last-seen
// write the next time that person appears.
const BOOKKEEPING_SWEEP_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - LAST_SEEN_THROTTLE_MS;
  for (const [id, at] of lastSeenTouch) if (at < cutoff) lastSeenTouch.delete(id);
  // Nothing timestamps the username cache, and it only exists to skip a
  // redundant write, so it is simply emptied.
  lastSeenUsername.clear();
}, BOOKKEEPING_SWEEP_MS).unref();
bot.use((ctx, next) => {
  const from = ctx.from;
  if (from?.id) {
    const handle = from.username || null;
    // Only write when it actually changed -- otherwise every single message
    // would cost a database round-trip for nothing.
    if (lastSeenUsername.get(from.id) !== handle) {
      lastSeenUsername.set(from.id, handle);
      Promise.resolve(setTelegramUsername(from.id, handle)).catch((err) =>
        console.error("username capture failed (ignored):", err.message)
      );
    }

    // "When were they last here" -- the only thing that can tell an active
    // person from one who drifted away, since updated_at moves only when the
    // anketa is saved. Throttled to once an hour per person: writing on every
    // update would be a database round-trip per tap for a field nothing reads
    // more than twice a day.
    const now = Date.now();
    if (now - (lastSeenTouch.get(from.id) || 0) > LAST_SEEN_THROTTLE_MS) {
      lastSeenTouch.set(from.id, now);
      Promise.resolve(touchLastSeen(from.id)).catch((err) =>
        console.error("last-seen update failed (ignored):", err.message)
      );
    }
  }
  return next();
});

bot.use(stage.middleware());

function languageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${LANGUAGES.uz.flag} ${LANGUAGES.uz.label}`, "lang:uz")],
    [Markup.button.callback(`${LANGUAGES.ru.flag} ${LANGUAGES.ru.label}`, "lang:ru")],
    [Markup.button.callback(`${LANGUAGES.en.flag} ${LANGUAGES.en.label}`, "lang:en")],
  ]);
}

// Every /start shows the language picker first, even for returning users --
// the choice is re-confirmed (and can be changed) on every fresh start.
// The exceptions are a "start=unlock_<id>" deep link (tapped from a
// candidate card's unlock link) and "start=policy" (tapped from the
// registration confirmation step's agreement link), both of which skip
// straight to their own flow instead of showing the language picker.
// What a plain /start does, on its own so the "Yangi profil ochish" button
// under a deletion notice can be exactly the same thing rather than a second
// path that drifts away from it.
async function startNewProfile(ctx) {
  await ctx.reply("Choose your language", languageKeyboard());
}

bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  if (payload === "policy") {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await sendPolicyDocument(ctx, lang);
    return;
  }
  if (payload && payload.startsWith("unlock_")) {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const candidateId = payload.slice("unlock_".length);
    await handleUnlockDeepLink(ctx, lang, candidateId);
    return;
  }

  // An invite link. The payload is read HERE and nowhere else -- it never
  // becomes message text, so the wizard's rule that a command is never
  // profile data (see commandName in profileWizard.js) stays intact.
  //
  // Only the pending row is written now. Nothing is paid until this person
  // finishes their anketa, because paying on the click is what would turn
  // throwaway accounts into free credits.
  const referrerId = referrerFromPayload(payload);
  if (referrerId) {
    try {
      const outcome = await registerReferralClick(referrerId, ctx.from.id);
      if (outcome !== "recorded") {
        console.log(`Referral from ${referrerId} for ${ctx.from.id} not recorded: ${outcome}`);
      }
    } catch (err) {
      // A broken invite must never stop somebody from signing up.
      console.error("referral click failed (ignored):", err.message);
    }
  }

  await startNewProfile(ctx);
});

bot.action(/^lang:(uz|ru|en)$/, async (ctx) => {
  const lang = ctx.match[1];
  await setLanguage(ctx.from.id, lang);
  await ctx.answerCbQuery();

  const existing = await getProfile(ctx.from.id);
  // isRegistered, not just "a record exists" -- see profileState.js.
  if (isRegistered(existing)) {
    await ctx.reply(t(lang, "welcomeBack")(existing.name));
    await sendMainMenu(ctx, lang);
    return;
  }
  await ctx.reply(t(lang, "welcomeNew"));
  await ctx.scene.enter("profile-wizard", { lang });
});

bot.command("anketa", async (ctx) => {
  const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
  await ctx.scene.enter("profile-wizard", { lang, isEditing: isRegistered(await getProfile(ctx.from.id)) });
});

// registerAnonChatHandlers is first: its bot.on("text", ...) relay check
// must run before any other hears()/on("text") handler, so a message from
// someone in an active anon chat is always forwarded, never accidentally
// matched by an unrelated button (e.g. the partner typing "❤️").
registerAnonChatHandlers(bot);
// Second, for the same reason: someone who has tapped "report" and is typing
// their complaint must have that message taken as the complaint, not matched
// against a menu label that happens to appear in what they wrote.
registerComplaintHandlers(bot);
// Third, and for the same reason again: someone partway through composing an
// ad is answering a question ("what is it called?"), so their message must
// reach that step rather than being matched against a menu label. It falls
// through with next() for everybody who has no draft open, which is almost
// everybody almost all of the time.
registerForStatisticHandlers(bot);
// The buttons under an "your account was deleted / hidden" notice. That
// message is sent by the admin bot but delivered through THIS bot, so this is
// where the taps arrive.
registerAccountNoticeHandlers(bot, { startNewProfile, safeAnswerCbQuery });
registerMenuHandlers(bot);
// Likes BEFORE discover: the two screens share the same ❤️ / 👎 / report /
// back labels under the chat, and the likes list has to get first refusal on
// them so a tap while working through your admirers answers THAT person
// rather than whoever was last on the browse screen. Every one of its
// handlers falls straight through with next() when the person is not in the
// likes list, so browsing is unaffected.
registerLikesHandlers(bot);
registerDiscoverHandlers(bot);
registerCheckoutHandlers(bot, { getLanguage, t, DEFAULT_LANG, safeAnswerCbQuery });

// What to resume once somebody actually subscribes. Registered here rather
// than inside each feature so the gate has one place that knows how to hand
// control back -- the person taps "check", and the thing they were doing
// simply continues, with no button to press again.
registerChannelGate(bot, {
  // openDiscovery re-reads language and profile itself, so this resumes the
  // browse exactly as tapping the menu button would -- the next candidate
  // simply appears and swiping carries on.
  discover: async (ctx) => {
    await openDiscovery(ctx);
  },
  anon: async (ctx) => {
    await attemptJoin(ctx, "any");
  },
});
registerProfileSettingsHandlers(bot);
registerPremiumHandlers(bot);
registerVipChatHandlers(bot);
// Says the group's chat id out loud the moment the bot is added to one --
// Telegram shows it nowhere in its apps, and every other way of finding it
// means routing through some third-party bot.
registerChatIdReporter(bot);
registerReferralHandlers(bot);
registerWinbackHandlers(bot, { openDiscovery });

bot.telegram
  .getMe()
  .then((me) => setUsername(me.username))
  .catch((err) => console.error("getMe failed:", err));

// The channel gate fails OPEN by design, so a misconfiguration looks exactly
// like "nobody needed the gate today". Probed at startup and every 15 minutes
// after, and surfaced on /health -- the fix (making the bot a channel admin)
// happens in Telegram, so /health has to notice it without a redeploy.
startChannelProbe(bot.telegram);

// Same reasoning, for the VIP group: every failure to mint an invite link
// falls back silently to the shared one, so a misconfiguration looks exactly
// like working software until somebody notices a link being passed around.
probeVipChat(bot.telegram).catch((err) => console.error("VIP invite probe failed:", err.message));

bot.catch((err, ctx) => {
  // Somebody blocking the bot is an ordinary, expected event, not a fault:
  // every reply to them fails with 403 from that moment on. Paging the
  // operator for each one would mean a 🚨 per person who ever walks away --
  // hundreds on a busy day -- and real crashes would be buried under them.
  //
  // Recorded rather than merely swallowed, so the win-back campaign stops
  // targeting an account that can no longer receive anything.
  if (isGoneError(err)) {
    const userId = ctx.from?.id;
    console.warn(`Bot was blocked by ${userId ?? "unknown user"} (ignored, recorded).`);
    if (userId) markBotBlocked(userId).catch(() => {});
    return;
  }

  console.error(`Bot error for update ${ctx.updateType}:`, err);
  alert(`Main bot error on ${ctx.updateType}:\n${err.stack || err.message}`).catch(() => {});

  // And say so to the person standing in front of it.
  //
  // Without this, a handler that throws produces total silence: the tap is
  // registered, nothing is sent, and from the outside the button is simply
  // dead. That is indistinguishable from a button that was never wired up,
  // so it gets reported as "the Premium button doesn't work" rather than as
  // an error -- and the one person who could act on it looks for the wrong
  // thing. A sentence costs nothing and turns a mystery into a retry.
  //
  // Every failure here is swallowed: this runs BECAUSE something already
  // failed, and an error thrown out of the error handler would take the whole
  // update down again for no gain.
  const chatId = ctx.chat?.id || ctx.from?.id;
  if (!chatId) return;
  getLanguage(ctx.from?.id)
    .catch(() => null)
    .then((lang) => ctx.telegram.sendMessage(chatId, t(lang || DEFAULT_LANG, "unexpectedError")))
    .catch(() => {});
});

if (webhookDomain) {
  const app = express();

  // Render terminates TLS and forwards, so without this every request looks
  // like it came from the proxy: req.ip would be one shared value and the
  // per-IP abuse counter on the Click endpoints would lump every caller --
  // including Click -- into a single bucket. One hop, not `true`: trusting
  // the whole X-Forwarded-For chain would let a caller spoof its own IP by
  // prepending one.
  app.set("trust proxy", 1);

  // What the last webhook check found, so /health can report "the bot is
  // running but Telegram is not sending it anything" -- the one outage that
  // otherwise looks completely healthy from outside.
  const webhookState = { status: "checking", detail: null };
  // Reports which storage backend is live so it can be confirmed from outside
  // without shell or log access -- the difference between "data survives a
  // deploy" and "data is wiped on every deploy" is otherwise invisible until
  // it's too late. Deliberately only the backend name: no connection string,
  // no credentials.
  app.get("/health", (req, res) =>
    res.status(200).json({
      status: "ok",
      storage: usePostgres ? "postgres" : "json-files",
      // Whether a private PIN is configured, never the PIN itself -- the
      // point is being able to confirm the insecure default is no longer in
      // use without needing shell or log access.
      adminPin: process.env.ADMIN_PIN_CODE ? "configured" : "DEFAULT (insecure)",
      // Without these no checkout link can be built at all, so every paid
      // feature silently degrades to "coming soon" -- worth being able to see
      // at a glance rather than discovering it from a user complaint.
      clickPayments:
        process.env.CLICK_MERCHANT_ID && process.env.CLICK_SERVICE_ID && process.env.CLICK_SECRET_KEY
          ? clickConfigProblem() || "configured"
          : "NOT CONFIGURED (no payments possible)",
      // Not secrets: both of these are query parameters in every checkout URL
      // the bot hands out, so anybody who has ever paid has seen them. Shown
      // because the one Click failure that produced no error anywhere -- a
      // merchant_id with a phone number accidentally appended -- was
      // invisible from here, and cost days of guessing. The secret key is
      // never shown, only whether it is present.
      clickIds: `service_id=${process.env.CLICK_SERVICE_ID || "?"} merchant_id=${process.env.CLICK_MERCHANT_ID || "?"}`,
      // Without ALERT_CHAT_ID, a crash or a broadcast failure is invisible
      // until someone thinks to load this page or a user complains -- worth
      // seeing at a glance, same reasoning as the two fields above it.
      alerts: ALERT_CHAT_ID ? "configured" : "NOT CONFIGURED (crashes and failures are silent)",
      // Same reasoning as clickPayments above: without these, the Payme
      // button is not offered at all and its callbacks are refused.
      paymePayments: paymeConfigured()
        ? paymeCheckoutIsTest()
          ? "configured (TEST checkout -- no real money)"
          : "configured"
        : "NOT CONFIGURED (Payme button hidden)",
      // Not a secret: the account field name and the merchant id both travel
      // in every checkout link. Shown for the same reason the Click ids are --
      // a mismatch between what Payme's cash-box expects here and what the
      // bot actually sends is invisible otherwise, and shows up only as
      // payments that never settle.
      paymeIds: `merchant_id=${process.env.PAYME_MERCHANT_ID || "?"} account_field=${paymeAccountField()}`,
      // Neither key's VALUE is shown, only which ones are present -- this is
      // the one thing "add PAYME_TEST_KEY in Render" cannot be confirmed
      // without: whether the value actually landed, as opposed to a typo'd
      // variable name or a deploy that hasn't picked it up yet.
      paymeKeys: `key=${process.env.PAYME_KEY ? "set" : "MISSING"} test_key=${process.env.PAYME_TEST_KEY ? "set" : "MISSING"}`,
      miniApp: MINI_APP_ENABLED ? "enabled" : "disabled",
      // Reads "active" only when the bot is genuinely an admin of the
      // channel. Anything else means the gate is letting everybody through --
      // which is deliberate (see channelGate.js rule 1) but invisible from
      // inside the bot, so it has to be visible from here.
      channelGate: channelGateStatus(),
      // "active" only when the bot can actually mint invite links for the VIP
      // group. Anything else means every buyer is getting the same shareable
      // link -- which works, and is exactly the thing being paid to avoid.
      vipInvites: vipInviteStatus(),
      // Powers the admin panel's "AI yordamchi" button -- without it that
      // button degrades to a message instead of failing.
      aiAssistant: process.env.ANTHROPIC_API_KEY
        ? "configured"
        : "NOT CONFIGURED (admin AI assistant disabled)",
      // The failure this endpoint previously could NOT see: everything above
      // can read "ok" while Telegram has no webhook for us, so the bot is
      // running and silently receiving nothing. Updated by the periodic
      // check below.
      webhook: webhookState.status,
      ...(webhookState.detail ? { webhookDetail: webhookState.detail } : {}),
      // Which commit is actually serving. Without this there is no way to
      // tell a finished deploy from a queued one except by finding a
      // behaviour that changed -- and when a deploy exists precisely to fix
      // "the bot answers nothing", there is no such behaviour to look at.
      // Render injects RENDER_GIT_COMMIT; anywhere else this is just absent.
      commit: (process.env.RENDER_GIT_COMMIT || "unknown").slice(0, 7),
      startedAt: STARTED_AT,
      // Whether the service is holding itself awake. Read together with
      // startedAt this answers "will the next tap be instant or a cold
      // start", which is otherwise only knowable by trying it.
      keepAwake: process.env.KEEP_AWAKE !== "false",
    })
  );
  app.get("/policy", (req, res) => res.type("html").send(renderPolicyHtml()));

  // The Mini App page and its API. Mounted here, on the same Express app that
  // already serves /policy, so it inherits the public HTTPS domain Telegram
  // requires for a web_app button -- no second service to deploy.
  // The Mini App is off by default. Its code is kept (nothing is deleted), so
  // turning it back on is one environment variable rather than a revert.
  if (MINI_APP_ENABLED) registerMiniApp(app, { botToken: token, telegram: bot.telegram });

  // Click's Prepare/Complete callbacks are form-encoded POST requests, but
  // this parser MUST be scoped to only those two routes (not app.use()'d
  // globally) -- express body-parsers set req.body = {} for every request
  // they see, even ones with a non-matching Content-Type. Telegraf's
  // webhookCallback treats a non-null req.body as "already parsed" and uses
  // it as-is instead of reading the real JSON payload, so a global
  // urlencoded() parser silently turned every Telegram update into {},
  // breaking /start and everything else.
  // Renewing while a subscription is still running must ADD to it, not reset
  // it to "days from today" -- otherwise someone who renews early silently
  // throws away every day they had left and effectively pays to lose time.
  // extended:false, not true. Click's callbacks are flat form fields, so the
  // nested-object/array syntax `extended:true` enables buys nothing here and
  // only widens what an attacker can shape req.body into before any of our
  // code looks at it. The size cap is likewise well above a Click callback
  // (a few hundred bytes) and far below anything worth buffering.
  const clickBodyParser = express.urlencoded({ extended: false, limit: "16kb" });

  // Named rather than inline so the retry sweep can run the exact same
  // delivery logic -- a recovered order must end up in precisely the state a
  // first-time success would have produced.
  const deliverPaidOrder = async (order) => {
      const lang = await getLanguage(order.userId) || DEFAULT_LANG;

      if (order.type === "unlock" && order.targetId) {
        await grantUnlock(order.userId, order.targetId);
        const candidate = await getProfile(order.targetId);
        if (candidate) {
          // A button rather than the profile itself. Payment happens in a
          // browser, so this arrives while the person is still on the bank's
          // "success" page or halfway back -- pushing photos into the chat at
          // that moment scrolls past unseen. One message they will actually
          // find when they return, with the way in attached to it. Pressing
          // it re-checks access (discover.js), so it is a shortcut, never a
          // second route around the paywall.
          await bot.telegram.sendMessage(order.userId, t(lang, "unlockPaidOpenProfile"), {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.callback(t(lang, "unlockOpenProfileButton"), `unlock:view:${order.targetId}`)],
            ]),
          });
        } else {
          await bot.telegram.sendMessage(order.userId, t(lang, "unlockSuccessNoContact"));
        }
        console.log(`Unlock granted: buyer ${order.userId} -> candidate ${order.targetId} (${order.amount} so'm via Click)`);
        return;
      }

      if (order.type === "vipchat") {
        // Recorded BEFORE the message goes out: if sending the invite link
        // fails (user temporarily unreachable, network blip), the paid access
        // still exists and pressing the VIP button again hands the link back,
        // instead of the payment simply vanishing.
        await grantVipChat(order.userId);
        // A link that admits exactly one person, minted for this buyer. A
        // shared link would let one 21 900 so'm purchase seat their whole
        // group; this one dies the moment it is used. Falls back to the
        // shared link if it cannot be created, because a purchase that
        // delivers nothing is the worse failure.
        const vipLink = await vipInviteLink(bot.telegram, order.userId, { paid: true });
        // Congratulation + what they just bought, not only a bare link: the
        // link alone leaves someone who paid 21 900 so'm with no sense of
        // what for.
        await bot.telegram.sendMessage(order.userId, t(lang, "vipPurchaseCongrats")(vipLink), {
          parse_mode: "HTML",
        });
        console.log(`VIP chat access granted to ${order.userId} (${order.amount} so'm via Click)`);
        return;
      }

      if (order.type === "adboard" && order.targetId) {
        // The money goes ON TOP of whatever the ad already holds, which is
        // what makes buying a higher place possible: a second payment has to
        // move you up, not reset you to whatever the latest single payment
        // was. This is also the step that makes the ad visible at all -- it
        // was written inactive at 0 so'm when the order was created.
        const ad = await addAdAmount(order.targetId, order.amount);
        if (!ad) {
          // The ad row is gone (deleted between paying and settling). Money
          // was taken, so this must not look like success -- leaving the
          // order undelivered puts it in front of the retry sweep and, when
          // that keeps failing, in front of a person.
          throw new Error(`ForStatistic ad ${order.targetId} no longer exists`);
        }

        const board = await listTopAds(FS_BOARD_LIMIT);
        const index = board.findIndex((row) => String(row.id) === String(ad.id));
        const place = index === -1 ? board.length : index + 1;

        await bot.telegram.sendMessage(
          order.userId,
          t(lang, "forStatisticPaidCongrats")({
            mark: place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🔸",
            place,
            money: `${Number(ad.amountSom).toLocaleString("uz-UZ")} so'm`,
          }),
          { parse_mode: "HTML" }
        );

        // Every ad is a link and a picture chosen by a member of the public,
        // shown to every user of the bot. Nobody would otherwise find out one
        // had gone live until somebody complained about it, so the operator
        // is told as it happens, with what they need to judge it.
        alert(
          `📊 ForStatistic: yangi afisha #${ad.id}\n` +
            `👤 ${order.userId}\n` +
            `📌 ${ad.name}\n` +
            `🔗 ${ad.link}\n` +
            `💰 ${Number(ad.amountSom).toLocaleString("uz-UZ")} so'm (${place}-o'rin)\n\n` +
            `Yashirish: /adhide_${ad.id}`,
          { bypassThrottle: true }
        ).catch(() => {});

        console.log(`ForStatistic ad ${ad.id} funded by ${order.userId} (+${order.amount} so'm, now ${ad.amountSom}, place ${place})`);
        return;
      }

      if (order.type === "anongender") {
        const anonGenderUntil = extendFrom((await getProfile(order.userId))?.anonGenderUntil, ANON_GENDER_DAYS);
        await setAnonGenderFilterUntil(order.userId, anonGenderUntil);
        // The 👧/👦 keyboard rides along with the message that tells them to
        // press it. Payment happens in a browser, so by the time this arrives
        // they may be anywhere in the bot -- without this, "press 👧 or 👦"
        // could land on a screen where neither button is on show.
        await bot.telegram.sendMessage(
          order.userId,
          t(lang, "anonSubscriptionActivated")(ANON_GENDER_DAYS, anonGenderUntil.slice(0, 10)),
          { parse_mode: "HTML", ...anonSubmenuKeyboard(lang) }
        );
        console.log(`Anon gender filter granted to ${order.userId} (${order.amount} so'm via Click)`);
        return;
      }

      const premiumUntil = extendFrom((await getProfile(order.userId))?.premiumUntil, PREMIUM_DAYS);
      await setPremiumUntil(order.userId, premiumUntil);
      await bot.telegram.sendMessage(order.userId, t(lang, "premiumPurchaseCongrats")(PREMIUM_DAYS), {
        parse_mode: "HTML",
      });
      console.log(`Premium activated for user ${order.userId} (${order.amount} so'm via Click)`);
  };

  registerClickRoutes(app, { bodyParser: clickBodyParser, onPaid: deliverPaidOrder });
  // Payme settles the SAME orders through the same delivery handler, so a
  // feature bought with either provider is granted by identical code. Its
  // callbacks are JSON-RPC rather than form-encoded, hence its own parser.
  registerPaymeRoutes(app, { bodyParser: express.json({ limit: "16kb" }), onPaid: deliverPaidOrder });

  app.use(bot.webhookCallback(webhookPath, webhookSecret ? { secretToken: webhookSecret } : undefined));

  if (adminBot) {
    app.use(adminBot.webhookCallback(adminWebhookPath, adminWebhookSecret ? { secretToken: adminWebhookSecret } : undefined));
  }

  // Registering the webhook is the one startup step that can fail in a way
  // that leaves the bot LOOKING healthy while receiving nothing: the HTTP
  // server answers /health, the menu button gets set, and messages simply
  // vanish into Telegram's queue.
  //
  // It is also the step most likely to fail, because setWebhook is not a
  // simple write -- Telegram connects BACK to the URL to validate it. Right
  // after a deploy the app is listening but the host's edge has not
  // necessarily started routing the public domain to it yet, so Telegram's
  // check fails. A fixed handful of retries over a minute is not enough for a
  // cold start, and once they were exhausted the bot stayed dead until a
  // person noticed. That has now happened twice.
  //
  // So instead of "try hard at boot and hope", the desired webhook is treated
  // as state to be kept true: check what Telegram actually has, fix it if it
  // is wrong, and keep checking. A boot-time failure heals itself a few
  // minutes later with nobody watching.
  //
  // Returns { ok, reason }. The reason matters: when this fails, the ONLY
  // symptom a user reports is "the bot is silent", and Telegram's own error
  // text ("secret token contains unallowed characters") names the cause
  // exactly. Throwing it away and reporting a bare "not registered" turned a
  // one-line fix into a long hunt once already, so it is carried through to
  // /health where it can be read without shell access to the host.
  async function ensureWebhook(telegram, url, options, label) {
    let info;
    try {
      info = await telegram.getWebhookInfo();
    } catch (err) {
      console.error(`${label} getWebhookInfo failed:`, err.message);
      return { ok: false, reason: `getWebhookInfo failed: ${err.message}` };
    }

    // Telegram reports why IT could not deliver -- far more useful than our
    // own logs when the bot goes quiet, so it is surfaced rather than hidden.
    if (info.last_error_message) {
      console.warn(`${label} webhook last error: ${info.last_error_message} (pending: ${info.pending_update_count || 0})`);
    }

    if (info.url === url) return { ok: true, reason: null };

    console.warn(`${label} webhook is "${info.url || "(none)"}" -- setting it to ${url}`);
    try {
      await telegram.setWebhook(url, options);
      console.log(`${label} webhook rejimida: ${url}`);
      return { ok: true, reason: null };
    } catch (err) {
      console.error(`${label} setWebhook failed:`, err.message);
      return { ok: false, reason: `setWebhook failed: ${err.message}` };
    }
  }

  // Frequent enough that a failed registration costs minutes rather than
  // hours, cheap enough to ignore: one getWebhookInfo per bot, and a
  // setWebhook only when something is actually wrong.
  const WEBHOOK_CHECK_MS = 3 * 60 * 1000;

  // reportsHealth: only the MAIN bot's webhook drives /health. The admin bot
  // is optional and its outage does not stop users being served, so mixing it
  // in would turn a green light amber for something users never notice.
  function keepWebhookRegistered(telegram, url, options, label, { reportsHealth = false } = {}) {
    const check = async () => {
      let result = { ok: false, reason: null };
      try {
        result = await ensureWebhook(telegram, url, options, label);
      } catch (err) {
        console.error(`${label} webhook check threw:`, err.message);
        result = { ok: false, reason: `webhook check threw: ${err.message}` };
      }
      if (reportsHealth) {
        webhookState.status = result.ok ? "registered" : "NOT REGISTERED (bot receives nothing)";
        webhookState.detail = result.ok ? null : `${url} -- ${result.reason || "unknown reason"}`;
      }
    };
    check();
    setInterval(check, WEBHOOK_CHECK_MS).unref();
  }

  // Nothing starts listening until the schema exists and the one-time import
  // has run -- an update arriving mid-startup would otherwise hit tables that
  // aren't there yet.
  prepareStorage()
    .then(() => {
      app.listen(port, () => {
        console.log(`HTTP server listening on port ${port}`);
      });

      // Any purchase that was paid for but never handed over (an outage while
      // Click's callback was being processed) is completed as soon as the bot
      // is healthy again, and then swept periodically.
      const DELIVERY_SWEEP_MS = 5 * 60 * 1000;
      retryUndeliveredOrders(deliverPaidOrder).catch((err) =>
        console.error("initial delivery sweep failed:", err.message)
      );
      setInterval(() => {
        retryUndeliveredOrders(deliverPaidOrder).catch((err) =>
          console.error("delivery sweep failed:", err.message)
        );
      }, DELIVERY_SWEEP_MS).unref();

      // Render's free plan stops a web service after ~15 minutes with no
      // inbound HTTP traffic, and starting it again takes the better part of
      // a minute. For a bot that means the FIRST tap after a quiet spell
      // waits for a cold start while Telegram, getting no answer, redelivers
      // the update -- indistinguishable to the person tapping from the bot
      // being broken.
      //
      // Requesting our own public URL counts as inbound traffic, so the
      // service never goes idle. It must be the public URL, not localhost:
      // only traffic through Render's router resets the idle timer.
      //
      // The cost is real and worth knowing: an always-awake service uses
      // ~730 instance-hours a month against a free allowance of 750 for the
      // whole account. That fits for ONE service and does not fit for two,
      // so KEEP_AWAKE=false turns it off without a redeploy.
      const KEEP_AWAKE_MS = 10 * 60 * 1000;
      if (process.env.KEEP_AWAKE !== "false") {
        const ping = () =>
          // Generous: a measured cold start on this plan took 27s, and the
          // very first ping after a deploy can still meet one. Aborting
          // early would only turn a working wake-up into a logged failure.
          fetch(`${webhookDomain}/health`, { signal: AbortSignal.timeout(60000) }).catch((err) =>
            console.warn("keep-awake ping failed (ignored):", err.message)
          );
        setInterval(ping, KEEP_AWAKE_MS).unref();
        console.log(`keep-awake: pinging ${webhookDomain}/health every ${KEEP_AWAKE_MS / 60000} min`);
      } else {
        console.log("keep-awake: disabled (KEEP_AWAKE=false) -- the service will sleep when idle");
      }

      // Runs inside this process on a timer, not as a second Render service:
      // the free plan bills instance-hours per ACCOUNT, so a second always-on
      // service would push the pair past the monthly allowance and stop both.
      startWinbackSweeper(bot.telegram);
      // Same timer-in-this-process reasoning. A subscription that ends with
      // no warning is felt as something taken away; these four messages turn
      // the last week into a conversation instead.
      startPremiumReminders(bot.telegram);

      keepWebhookRegistered(
        bot.telegram,
        `${webhookDomain}${webhookPath}`,
        webhookSecret ? { secret_token: webhookSecret } : undefined,
        "ForOneForever_bot",
        { reportsHealth: true }
      );

      if (adminBot) {
        keepWebhookRegistered(
          adminBot.telegram,
          `${webhookDomain}${adminWebhookPath}`,
          adminWebhookSecret ? { secret_token: adminWebhookSecret } : undefined,
          "ForOneAdmin_bot"
        );
      }

      // The menu button is a setting stored on TELEGRAM's side, not ours: it
      // stays on every existing chat until it is actively changed. So turning
      // the Mini App off means putting the button back, not merely stopping
      // serving the page -- otherwise everyone who already has the button
      // keeps a "Kabinet" that opens a dead URL.
      const menuButton = MINI_APP_ENABLED
        ? { type: "web_app", text: "Kabinet", web_app: { url: `${webhookDomain}/app` } }
        : { type: "commands" };
      bot.telegram
        .setChatMenuButton({ menuButton })
        .then(() =>
          console.log(
            MINI_APP_ENABLED
              ? `Mini App menu button -> ${webhookDomain}/app`
              : "Mini App disabled -- menu button reset to the default commands button."
          )
        )
        .catch((err) => console.error("setChatMenuButton failed (ignored):", err.message));
    })
    .catch((err) => {
      console.error("Storage initialisation failed -- refusing to start:", err);
      process.exit(1);
    });
} else {
  prepareStorage()
    .then(async () => {
      await bot.launch();
      console.log("ForOneForever_bot ishga tushdi (long polling, domen sozlanmagan).");
      if (adminBot) {
        await adminBot.launch();
        console.log("ForOneAdmin_bot ishga tushdi (long polling, domen sozlanmagan).");
      }
    })
    .catch((err) => {
      console.error("Storage initialisation failed -- refusing to start:", err);
      process.exit(1);
    });
}

// Telegraf's own .stop() throws "Bot is not running!" unless launch() or
// startWebhook() set its internal polling/webhookServer state -- neither
// ever happens here, since webhook mode mounts bot.webhookCallback() on our
// OWN Express app instead. That made every single SIGTERM (i.e. every
// Render deploy/restart) crash with an uncaught exception instead of
// exiting cleanly.
function safeStop(botInstance, reason) {
  try {
    botInstance.stop(reason);
  } catch (err) {
    console.error(`Bot stop() failed (${reason}, likely webhook mode -- harmless):`, err.message);
  }
}

// process.once(...) replaces Node's default "terminate immediately" SIGINT/
// SIGTERM behavior, so an explicit process.exit() is required afterward --
// previously the crash from bot.stop() accidentally caused that exit; now
// that it's caught cleanly, without this call the process would just hang
// past the signal forever instead of shutting down.
async function shutdown(reason) {
  safeStop(bot, reason);
  if (adminBot) safeStop(adminBot, reason);
  // Lets Postgres release the connections instead of leaving them to time out
  // server-side; bounded so a hung pool can't stop the process from exiting.
  try {
    await Promise.race([closeStorage(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch (err) {
    console.error("Closing storage failed (exiting anyway):", err.message);
  }
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
