const { Telegraf, session } = require("telegraf");

const { BOT_TOKEN } = require("./config");
const storage = require("./storage");
const { mainMenuKeyboard, jinsKeyboard, settingsKeyboard } = require("./menu");
require("./keepAlive");

const bot = new Telegraf(BOT_TOKEN);
bot.use(session({ defaultSession: () => ({ step: null, draft: {} }) }));

const JINS_LABELS = { erkak: "Erkak 👨", ayol: "Ayol 👩" };

const WELCOME_TEXT =
  "Assalomu alaykum! 🌙\n\n" +
  "Bu — tanishuv va suhbatlashish uchun anonim bot. Uyalmang, bu yerda hammasi erkin va xavfsiz 😊\n\n" +
  "Boshlash uchun avval qisqacha anketa to'ldiramiz.\n\n" +
  "👤 Ismingizni kiriting:";

const formatProfile = (profile) =>
  "🆕 Anketangiz tayyor!\n\n" +
  `👤 Ism: ${profile.ism}\n` +
  `🎂 Yosh: ${profile.yosh}\n` +
  `⚧ Jins: ${JINS_LABELS[profile.jins] || profile.jins}\n` +
  `📍 Manzil: ${profile.manzil}\n` +
  `🔗 Akkaunt: ${profile.akkaunt}\n` +
  `📝 Ma'lumot: ${profile.malumot}`;

const startProfileFlow = async (ctx) => {
  ctx.session.step = "ism";
  ctx.session.draft = {};
  await ctx.reply(WELCOME_TEXT);
};

bot.start(async (ctx) => {
  const existing = storage.getUser(ctx.chat.id);
  if (existing) {
    await ctx.reply(formatProfile(existing));
    await ctx.reply("Quyidagi menyudan birini tanlang 👇", mainMenuKeyboard);
    return;
  }
  await startProfileFlow(ctx);
});

bot.command("anketa", async (ctx) => {
  const existing = storage.getUser(ctx.chat.id);
  if (existing) {
    await ctx.reply(formatProfile(existing), settingsKeyboard);
    return;
  }
  await startProfileFlow(ctx);
});

bot.on("text", async (ctx, next) => {
  const step = ctx.session.step;
  const text = ctx.message.text.trim();

  if (!step) {
    return next();
  }

  if (step === "ism") {
    if (text.length < 2 || text.length > 50) {
      await ctx.reply("Ism 2 dan 50 belgigacha bo'lishi kerak. Qaytadan kiriting:");
      return;
    }
    ctx.session.draft.ism = text;
    ctx.session.step = "yosh";
    await ctx.reply("🎂 Yoshingizni kiriting (raqamda, masalan: 21):");
    return;
  }

  if (step === "yosh") {
    const yosh = Number(text);
    if (!Number.isInteger(yosh) || yosh < 13 || yosh > 100) {
      await ctx.reply("Iltimos, yoshingizni to'g'ri raqamda kiriting (13-100):");
      return;
    }
    ctx.session.draft.yosh = yosh;
    ctx.session.step = "jins";
    await ctx.reply("⚧ Jinsingizni tanlang:", jinsKeyboard);
    return;
  }

  if (step === "manzil") {
    if (text.length < 2 || text.length > 100) {
      await ctx.reply("Manzilni 2 dan 100 belgigacha kiriting (masalan: Toshkent):");
      return;
    }
    ctx.session.draft.manzil = text;
    ctx.session.step = "akkaunt";
    await ctx.reply("🔗 Ijtimoiy tarmoq akkauntingizni kiriting (masalan: Instagram @username):");
    return;
  }

  if (step === "akkaunt") {
    if (text.length < 1 || text.length > 100) {
      await ctx.reply("Akkaunt nomini kiriting (1-100 belgi):");
      return;
    }
    ctx.session.draft.akkaunt = text;
    ctx.session.step = "malumot";
    await ctx.reply("📝 O'zingiz haqingizda qisqacha ma'lumot yozing:");
    return;
  }

  if (step === "malumot") {
    if (text.length < 2 || text.length > 500) {
      await ctx.reply("Qisqacha ma'lumotni 2 dan 500 belgigacha yozing:");
      return;
    }
    ctx.session.draft.malumot = text;

    const profile = storage.saveUser(ctx.chat.id, {
      ...ctx.session.draft,
      username: ctx.from.username || null,
    });

    ctx.session.step = null;
    ctx.session.draft = {};

    await ctx.reply(formatProfile(profile));
    await ctx.reply("Quyidagi menyudan birini tanlang 👇", mainMenuKeyboard);
    return;
  }

  return next();
});

bot.action(/jins:(erkak|ayol)/, async (ctx) => {
  if (ctx.session.step !== "jins") {
    await ctx.answerCbQuery();
    return;
  }
  ctx.session.draft.jins = ctx.match[1];
  ctx.session.step = "manzil";
  await ctx.answerCbQuery();
  await ctx.editMessageText(`⚧ Jins: ${JINS_LABELS[ctx.match[1]]}`);
  await ctx.reply("📍 Manzilingizni kiriting (masalan: Toshkent):");
});

const STUB_TEXT = {
  search: "🔧 \"Qidirish\" bo'limi tez kunda ishga tushadi.",
  likes: "🔧 \"Menga kim layk bosdi\" bo'limi tez kunda ishga tushadi.",
  vip: "🔧 \"VIP CHAT\" bo'limi tez kunda ishga tushadi.",
  premium: "🔧 \"PREMIUM\" bo'limi tez kunda ishga tushadi.",
};

bot.action(["menu:search", "menu:likes", "menu:vip", "menu:premium"], async (ctx) => {
  const key = ctx.callbackQuery.data.split(":")[1];
  await ctx.answerCbQuery();
  await ctx.reply(STUB_TEXT[key]);
});

bot.action("menu:settings", async (ctx) => {
  const profile = storage.getUser(ctx.chat.id);
  await ctx.answerCbQuery();
  if (!profile) {
    await startProfileFlow(ctx);
    return;
  }
  await ctx.reply(formatProfile(profile), settingsKeyboard);
});

bot.action("menu:back", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Quyidagi menyudan birini tanlang 👇", mainMenuKeyboard);
});

bot.action("menu:reset", async (ctx) => {
  await ctx.answerCbQuery();
  await startProfileFlow(ctx);
});

bot.launch();
console.log("Qora bot ishga tushdi.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
