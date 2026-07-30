require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const { Telegraf, Scenes, Markup, session } = require("telegraf");
const { profileWizard } = require("./scenes/profileWizard");
const { registerMenuHandlers, sendMainMenu } = require("./menu");
const { registerDiscoverHandlers, handleUnlockDeepLink, sendProfileToChat } = require("./discover");
const { registerLikesHandlers } = require("./likes");
const { registerProfileSettingsHandlers } = require("./profileSettings");
const { registerPremiumHandlers } = require("./premium");
const { registerVipChatHandlers, VIP_CHAT_INVITE_LINK } = require("./vipChat");
const { registerAnonChatHandlers, leaveAnonQueueOrChat, anonSubmenuKeyboard } = require("./anonChat");
const { registerComplaintHandlers } = require("./complaints");
const { registerAccountNoticeHandlers } = require("./accountNotices");
const { registerMiniApp } = require("./miniApp");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { isRegistered } = require("./profileState");
const { floodGuardMiddleware } = require("./floodGuard");
const { registerClickRoutes, retryUndeliveredOrders, PREMIUM_DAYS, ANON_GENDER_DAYS } = require("./click");
const { createAdminBot } = require("./adminBot");
const {
  getProfile, getLanguage, setLanguage, setPremiumUntil, setAnonGenderFilterUntil,
  grantUnlock, grantVipChat, setTelegramUsername, initStorage, closeStorage, usePostgres,
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
// Continuing is safe here specifically because this app keeps no long-lived
// in-memory state that could be left half-updated: everything persistent is
// read from disk per operation and written atomically, and the only in-memory
// state (anon-chat queues) is deliberately disposable. So there is nothing to
// protect by exiting -- only uptime to lose.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (bot kept running):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (bot kept running):", err);
});

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
// The buttons under an "your account was deleted / hidden" notice. That
// message is sent by the admin bot but delivered through THIS bot, so this is
// where the taps arrive.
registerAccountNoticeHandlers(bot, { startNewProfile, safeAnswerCbQuery });
registerMenuHandlers(bot);
registerDiscoverHandlers(bot);
registerLikesHandlers(bot);
registerProfileSettingsHandlers(bot);
registerPremiumHandlers(bot);
registerVipChatHandlers(bot);

bot.telegram
  .getMe()
  .then((me) => setUsername(me.username))
  .catch((err) => console.error("getMe failed:", err));

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

if (webhookDomain) {
  const app = express();

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
          ? "configured"
          : "NOT CONFIGURED (no payments possible)",
      // The failure this endpoint previously could NOT see: everything above
      // can read "ok" while Telegram has no webhook for us, so the bot is
      // running and silently receiving nothing. Updated by the periodic
      // check below.
      webhook: webhookState.status,
      ...(webhookState.detail ? { webhookDetail: webhookState.detail } : {}),
    })
  );
  app.get("/policy", (req, res) => res.type("html").send(renderPolicyHtml()));

  // The Mini App page and its API. Mounted here, on the same Express app that
  // already serves /policy, so it inherits the public HTTPS domain Telegram
  // requires for a web_app button -- no second service to deploy.
  registerMiniApp(app, { botToken: token, telegram: bot.telegram });

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
  function extendFrom(currentUntilIso, days) {
    const now = Date.now();
    const current = currentUntilIso ? new Date(currentUntilIso).getTime() : 0;
    const base = Number.isFinite(current) && current > now ? current : now;
    return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  }

  const clickBodyParser = express.urlencoded({ extended: true });

  // Named rather than inline so the retry sweep can run the exact same
  // delivery logic -- a recovered order must end up in precisely the state a
  // first-time success would have produced.
  const deliverPaidOrder = async (order) => {
      const lang = await getLanguage(order.userId) || DEFAULT_LANG;

      if (order.type === "unlock" && order.targetId) {
        await grantUnlock(order.userId, order.targetId);
        const candidate = await getProfile(order.targetId);
        if (candidate) {
          await bot.telegram.sendMessage(
            order.userId,
            `${t(lang, "unlockPaymentSuccessIntro")}\n\n${t(lang, "profileBelowIntro")}`
          );
          await sendProfileToChat(bot.telegram, order.userId, lang, order.targetId);
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
        await bot.telegram.sendMessage(order.userId, t(lang, "vipJoinMessage")(VIP_CHAT_INVITE_LINK));
        console.log(`VIP chat access granted to ${order.userId} (${order.amount} so'm via Click)`);
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
      await bot.telegram.sendMessage(order.userId, t(lang, "premiumActivated")(PREMIUM_DAYS));
      console.log(`Premium activated for user ${order.userId} (${order.amount} so'm via Click)`);
  };

  registerClickRoutes(app, { bodyParser: clickBodyParser, onPaid: deliverPaidOrder });

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

      // Replaces the default "Menu"/"/" button next to the input box with one
      // that opens the Mini App. Set once at startup rather than per chat, so
      // it is there for everyone including people who never open the menu.
      bot.telegram
        .setChatMenuButton({
          menuButton: { type: "web_app", text: "Kabinet", web_app: { url: `${webhookDomain}/app` } },
        })
        .then(() => console.log(`Mini App menu button -> ${webhookDomain}/app`))
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
