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
const { registerAnonChatHandlers, leaveAnonQueueOrChat } = require("./anonChat");
const { registerClickRoutes, PREMIUM_DAYS, ANON_GENDER_DAYS } = require("./click");
const { createAdminBot } = require("./adminBot");
const { getProfile, getLanguage, setLanguage, setPremiumUntil, setAnonGenderFilterUntil, grantUnlock, grantVipChat } = require("./db");
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
let webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!webhookSecret && webhookDomain) {
  webhookSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "TELEGRAM_WEBHOOK_SECRET was not set -- auto-generated a random one for this run. " +
      "Set it explicitly in your environment to silence this warning."
  );
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
const adminBot = adminToken ? createAdminBot(adminToken) : null;
const adminWebhookPath = "/telegram/admin-webhook";
let adminWebhookSecret = process.env.ADMIN_WEBHOOK_SECRET;
if (adminBot && !adminWebhookSecret && webhookDomain) {
  adminWebhookSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "ADMIN_WEBHOOK_SECRET was not set -- auto-generated a random one for this run. " +
      "Set it explicitly in your environment to silence this warning."
  );
}

const bot = new Telegraf(token);
const stage = new Scenes.Stage([profileWizard]);

bot.use(session());
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
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  if (payload === "policy") {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await sendPolicyDocument(ctx, lang);
    return;
  }
  if (payload && payload.startsWith("unlock_")) {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const candidateId = payload.slice("unlock_".length);
    await handleUnlockDeepLink(ctx, lang, candidateId);
    return;
  }
  await ctx.reply("Choose your language", languageKeyboard());
});

bot.action(/^lang:(uz|ru|en)$/, async (ctx) => {
  const lang = ctx.match[1];
  setLanguage(ctx.from.id, lang);
  await ctx.answerCbQuery();

  const existing = getProfile(ctx.from.id);
  if (existing) {
    await ctx.reply(t(lang, "welcomeBack")(existing.name));
    await sendMainMenu(ctx, lang);
    return;
  }
  await ctx.reply(t(lang, "welcomeNew"));
  await ctx.scene.enter("profile-wizard", { lang });
});

bot.command("anketa", async (ctx) => {
  const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
  await ctx.scene.enter("profile-wizard", { lang, isEditing: !!getProfile(ctx.from.id) });
});

// registerAnonChatHandlers is first: its bot.on("text", ...) relay check
// must run before any other hears()/on("text") handler, so a message from
// someone in an active anon chat is always forwarded, never accidentally
// matched by an unrelated button (e.g. the partner typing "❤️").
registerAnonChatHandlers(bot);
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
  app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
  app.get("/policy", (req, res) => res.type("html").send(renderPolicyHtml()));

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
  registerClickRoutes(app, {
    bodyParser: clickBodyParser,
    onPaid: async (order) => {
      const lang = getLanguage(order.userId) || DEFAULT_LANG;

      if (order.type === "unlock" && order.targetId) {
        grantUnlock(order.userId, order.targetId);
        const candidate = getProfile(order.targetId);
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
        grantVipChat(order.userId);
        await bot.telegram.sendMessage(order.userId, t(lang, "vipJoinMessage")(VIP_CHAT_INVITE_LINK));
        console.log(`VIP chat access granted to ${order.userId} (${order.amount} so'm via Click)`);
        return;
      }

      if (order.type === "anongender") {
        const anonGenderUntil = extendFrom(getProfile(order.userId)?.anonGenderUntil, ANON_GENDER_DAYS);
        setAnonGenderFilterUntil(order.userId, anonGenderUntil);
        await bot.telegram.sendMessage(order.userId, t(lang, "anonSubscriptionActivated")(ANON_GENDER_DAYS));
        console.log(`Anon gender filter granted to ${order.userId} (${order.amount} so'm via Click)`);
        return;
      }

      const premiumUntil = extendFrom(getProfile(order.userId)?.premiumUntil, PREMIUM_DAYS);
      setPremiumUntil(order.userId, premiumUntil);
      await bot.telegram.sendMessage(order.userId, t(lang, "premiumActivated")(PREMIUM_DAYS));
      console.log(`Premium activated for user ${order.userId} (${order.amount} so'm via Click)`);
    },
  });

  app.use(bot.webhookCallback(webhookPath, webhookSecret ? { secretToken: webhookSecret } : undefined));

  if (adminBot) {
    app.use(adminBot.webhookCallback(adminWebhookPath, adminWebhookSecret ? { secretToken: adminWebhookSecret } : undefined));
  }

  app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });

  // A transient hiccup right at container boot (DNS/networking not fully up
  // yet) can make the very first setWebhook call fail, silently leaving the
  // bot with NO webhook registered until someone notices and fixes it by
  // hand. Retries with backoff so a boot-time blip self-heals instead of
  // requiring manual intervention.
  async function setWebhookWithRetry(telegram, url, options, label, attempt = 1, maxAttempts = 5) {
    try {
      await telegram.setWebhook(url, options);
      console.log(`${label} webhook rejimida: ${url}`);
    } catch (err) {
      console.error(`${label} setWebhook failed (attempt ${attempt}/${maxAttempts}):`, err.message);
      if (attempt >= maxAttempts) return;
      const delayMs = 2 ** attempt * 1000;
      setTimeout(() => setWebhookWithRetry(telegram, url, options, label, attempt + 1, maxAttempts), delayMs);
    }
  }

  setWebhookWithRetry(
    bot.telegram,
    `${webhookDomain}${webhookPath}`,
    webhookSecret ? { secret_token: webhookSecret } : undefined,
    "ForOneForever_bot"
  );

  if (adminBot) {
    setWebhookWithRetry(
      adminBot.telegram,
      `${webhookDomain}${adminWebhookPath}`,
      adminWebhookSecret ? { secret_token: adminWebhookSecret } : undefined,
      "ForOneAdmin_bot"
    );
  }
} else {
  bot.launch().then(() => {
    console.log("ForOneForever_bot ishga tushdi (long polling, domen sozlanmagan).");
  });
  if (adminBot) {
    adminBot.launch().then(() => {
      console.log("ForOneAdmin_bot ishga tushdi (long polling, domen sozlanmagan).");
    });
  }
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
process.once("SIGINT", () => {
  safeStop(bot, "SIGINT");
  if (adminBot) safeStop(adminBot, "SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  safeStop(bot, "SIGTERM");
  if (adminBot) safeStop(adminBot, "SIGTERM");
  process.exit(0);
});
