require("dotenv").config();
const { Telegraf, Scenes, session } = require("telegraf");
const { profileWizard } = require("./scenes/profileWizard");
const { registerMenuHandlers, sendMainMenu } = require("./menu");
const { getProfile } = require("./db");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const bot = new Telegraf(token);
const stage = new Scenes.Stage([profileWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const existing = getProfile(ctx.from.id);
  if (existing) {
    await ctx.reply(`Xush kelibsiz qaytganingizdan xursandmiz, ${existing.name}!`);
    await sendMainMenu(ctx, existing);
    return;
  }
  await ctx.reply(
    "Assalomu alaykum! 👋 Tanishish va uylanish maqsadidagi botimizga xush kelibsiz.\n" +
      "Avval qisqacha anketangizni to'ldiramiz."
  );
  await ctx.scene.enter("profile-wizard");
});

bot.command("anketa", async (ctx) => {
  await ctx.scene.enter("profile-wizard");
});

registerMenuHandlers(bot);

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

bot.launch().then(() => {
  console.log("ForOneForever_bot ishga tushdi (long polling).");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
