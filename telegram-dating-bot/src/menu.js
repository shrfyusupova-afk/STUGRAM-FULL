const { Markup } = require("telegraf");

// Deliberately a different layout/wording from the reference screenshot
// (different grouping, emoji, and copy) rather than a direct clone.
// Button actions themselves are wired up later -- for now each one just
// acknowledges the tap so the menu doesn't feel broken while idle.
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔍 Yangi tanishuvlar", "menu:discover"),
      Markup.button.callback("👤 Anketam", "menu:profile"),
    ],
    [
      Markup.button.callback("💌 Kimlar yoqtirdi", "menu:likes"),
      Markup.button.callback("💎 VIP suhbat", "menu:vip"),
    ],
    [Markup.button.callback("⭐ Premium", "menu:premium")],
  ]);
}

async function sendMainMenu(ctx, profile) {
  const summary =
    `✅ Anketangiz saqlandi!\n\n` +
    `👤 Ism: ${profile.name}\n` +
    `🎂 Yosh: ${profile.age}\n` +
    `⚧ Jins: ${profile.gender}\n` +
    `📍 Manzil: ${profile.location}\n` +
    `🔗 Akkaunt: ${profile.account}\n` +
    `📝 Ma'lumot: ${profile.bio}`;

  await ctx.reply(summary);
  await ctx.reply("Quyidagilardan birini tanlang:", mainMenuKeyboard());
}

function registerMenuHandlers(bot) {
  const placeholders = {
    "menu:discover": "🔍 Yangi tanishuvlar bo'limi tez orada ishga tushadi.",
    "menu:profile": "👤 Anketani ko'rish/tahrirlash tez orada qo'shiladi.",
    "menu:likes": "💌 Kim sizni yoqtirganini ko'rish tez orada qo'shiladi.",
    "menu:vip": "💎 VIP suhbat funksiyasi tez orada qo'shiladi.",
    "menu:premium": "⭐ Premium tarif tez orada qo'shiladi.",
  };

  for (const [action, text] of Object.entries(placeholders)) {
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(text);
    });
  }
}

module.exports = { mainMenuKeyboard, sendMainMenu, registerMenuHandlers };
