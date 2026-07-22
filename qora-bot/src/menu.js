const { Markup } = require("telegraf");

// Skrinshotdagi 2xN "karta" tugmalar o'rniga sinov uchun boshqacha variant:
// har biri alohida qatorda, ro'yxat ko'rinishidagi inline tugmalar.
const mainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("🔍 Qidirish", "menu:search")],
  [Markup.button.callback("⚙️ Anketa sozlamalari", "menu:settings")],
  [Markup.button.callback("❤️ Menga kim layk bosdi", "menu:likes")],
  [Markup.button.callback("👑 VIP CHAT", "menu:vip")],
  [Markup.button.callback("💎 PREMIUM", "menu:premium")],
]);

const jinsKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("👨 Erkak", "jins:erkak"), Markup.button.callback("👩 Ayol", "jins:ayol")],
]);

const settingsKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("🔄 Anketani qayta to'ldirish", "menu:reset")],
  [Markup.button.callback("⬅️ Orqaga", "menu:back")],
]);

module.exports = { mainMenuKeyboard, jinsKeyboard, settingsKeyboard };
