const { Markup } = require("telegraf");

// Telegram bots can't set custom button colors -- neither reply keyboards
// nor inline keyboards expose a color/style field; button appearance is
// entirely up to the user's Telegram client theme. Colored circle emoji in
// the label is the closest available substitute for "colored buttons".
const BUTTONS = {
  discover: "🔴 Yangi tanishuvlar",
  profile: "🔵 Anketam",
  likes: "🟢 Kimlar yoqtirdi",
  vip: "🟣 VIP suhbat",
  premium: "🟡 Premium",
};

// A persistent bottom (reply) keyboard, not an inline keyboard attached to
// one chat message -- stays docked under the input box across the whole
// conversation instead of scrolling away with the chat.
function mainMenuKeyboard() {
  return Markup.keyboard([
    [BUTTONS.discover, BUTTONS.profile],
    [BUTTONS.likes, BUTTONS.vip],
    [BUTTONS.premium],
  ])
    .resize()
    .persistent();
}

async function sendMainMenu(ctx, profile) {
  const summary =
    `✅ Anketangiz saqlandi!\n\n` +
    `👤 Ism: ${profile.name}\n` +
    `🎂 Yosh: ${profile.age}\n` +
    `⚧ Jins: ${profile.gender}\n` +
    `📍 Manzil: ${profile.location}\n` +
    `🔗 Akkaunt: ${profile.account}\n` +
    `📝 Ma'lumot: ${profile.bio}\n` +
    `📞 Tasdiqlangan raqam: ${profile.phone}`;

  await ctx.reply(summary, mainMenuKeyboard());
}

function registerMenuHandlers(bot) {
  const placeholders = {
    [BUTTONS.discover]: "🔴 Yangi tanishuvlar bo'limi tez orada ishga tushadi.",
    [BUTTONS.profile]: "🔵 Anketani ko'rish/tahrirlash tez orada qo'shiladi.",
    [BUTTONS.likes]: "🟢 Kim sizni yoqtirganini ko'rish tez orada qo'shiladi.",
    [BUTTONS.vip]: "🟣 VIP suhbat funksiyasi tez orada qo'shiladi.",
    [BUTTONS.premium]: "🟡 Premium tarif tez orada qo'shiladi.",
  };

  for (const [label, text] of Object.entries(placeholders)) {
    bot.hears(label, async (ctx) => {
      await ctx.reply(text);
    });
  }
}

module.exports = { BUTTONS, mainMenuKeyboard, sendMainMenu, registerMenuHandlers };
