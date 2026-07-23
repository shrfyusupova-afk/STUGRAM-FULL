require("dotenv").config();
const express = require("express");
const { Telegraf, Scenes, Markup, session } = require("telegraf");
const { profileWizard } = require("./scenes/profileWizard");
const { registerMenuHandlers, sendMainMenu } = require("./menu");
const { getProfile, getLanguage, setLanguage } = require("./db");
const { LANGUAGES, DEFAULT_LANG, t } = require("./i18n");

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
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;
const port = process.env.PORT || 3000;

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
bot.start(async (ctx) => {
  await ctx.reply("Choose your language", languageKeyboard());
});

bot.action(/^lang:(uz|ru|en)$/, async (ctx) => {
  const lang = ctx.match[1];
  setLanguage(ctx.from.id, lang);
  await ctx.answerCbQuery();

  const existing = getProfile(ctx.from.id);
  if (existing) {
    await ctx.reply(t(lang, "welcomeBack")(existing.name));
    await sendMainMenu(ctx, existing, lang);
    return;
  }
  await ctx.reply(t(lang, "welcomeNew"));
  await ctx.scene.enter("profile-wizard", { lang });
});

bot.command("anketa", async (ctx) => {
  const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
  await ctx.scene.enter("profile-wizard", { lang });
});

registerMenuHandlers(bot);

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

if (webhookDomain) {
  const app = express();
  app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
  app.use(bot.webhookCallback(webhookPath, webhookSecret ? { secretToken: webhookSecret } : undefined));

  app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });

  bot.telegram
    .setWebhook(`${webhookDomain}${webhookPath}`, webhookSecret ? { secret_token: webhookSecret } : undefined)
    .then(() => console.log(`ForOneForever_bot webhook rejimida: ${webhookDomain}${webhookPath}`))
    .catch((err) => console.error("setWebhook failed:", err));
} else {
  bot.launch().then(() => {
    console.log("ForOneForever_bot ishga tushdi (long polling, domen sozlanmagan).");
  });
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
