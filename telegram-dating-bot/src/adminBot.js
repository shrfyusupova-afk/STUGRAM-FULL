const { Telegraf, Markup } = require("telegraf");
const { getAllProfiles, getProfile, setProfileActive, deleteProfile, isAdmin, addAdmin } = require("./db");
const { getSalesSummary } = require("./click");

const ADMIN_CODE = "19752901";
const STATS_LABEL = "📊 Statistika";
const USERS_LABEL = "👥 Foydalanuvchilar";
const SALES_LABEL = "💰 Sotuvlar";

// In-memory only: which digits an unauthenticated user has entered so far.
// Resets on restart -- acceptable, it's just a login-attempt-in-progress
// cache, not anything that needs to survive a deploy.
const loginState = new Map();

// Shows entered digits as-is (not masked) with underscores for the
// remaining slots, e.g. "1 9 7 5 _ _ _ _".
function maskCode(entered) {
  const slots = [];
  for (let i = 0; i < ADMIN_CODE.length; i++) {
    slots.push(i < entered.length ? entered[i] : "_");
  }
  return slots.join(" ");
}

function digitButton(d) {
  return Markup.button.callback(d, `admin:pin:${d}`);
}

function pinKeyboard() {
  return Markup.inlineKeyboard([
    [digitButton("1"), digitButton("2"), digitButton("3")],
    [digitButton("4"), digitButton("5"), digitButton("6")],
    [digitButton("7"), digitButton("8"), digitButton("9")],
    [Markup.button.callback("⌫", "admin:pin:back"), digitButton("0")],
  ]);
}

function adminMenuKeyboard() {
  return Markup.keyboard([[STATS_LABEL, USERS_LABEL], [SALES_LABEL]]).resize();
}

// Wraps a handler so it silently no-ops for anyone not in data/admins.json --
// no error, no hint that anything exists, just nothing happens.
function requireAdmin(handler) {
  return async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    return handler(ctx);
  };
}

function userCard(id, profile) {
  const status = profile.active === false ? "🔴 Faolsiz" : "🟢 Faol";
  const premium =
    profile.premiumUntil && new Date(profile.premiumUntil) > new Date()
      ? `\n💎 Premium: ${new Date(profile.premiumUntil).toISOString().slice(0, 10)} gacha`
      : "";
  return (
    `👤 ${profile.name}, ${profile.age}\n` +
    `🆔 ${id}\n` +
    `📍 ${profile.location}\n` +
    `Holat: ${status}${premium}`
  );
}

function userActionsKeyboard(id, profile) {
  const toggleLabel = profile.active === false ? "🟢 Faollantirish" : "🔴 Faolsizlantirish";
  return Markup.inlineKeyboard([
    [Markup.button.callback(toggleLabel, `admin:toggle:${id}`), Markup.button.callback("🗑 O'chirish", `admin:delete:${id}`)],
  ]);
}

// A failed answerCbQuery/editMessageText (stale query, "message is not
// modified", a transient network hiccup) must never abort the handler
// partway through -- the digit is already recorded in loginState by the
// time these run, so a swallowed display error just means the next tap
// re-renders the correct, fully caught-up text instead of silently
// dropping that digit from what the user sees.
async function safeAnswerCbQuery(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (err) {
    console.error("admin bot answerCbQuery failed (ignored):", err.message);
  }
}

async function safeEditMessageText(ctx, text, extra) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    console.error("admin bot editMessageText failed (ignored):", err.message);
  }
}

function createAdminBot(token) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    if (isAdmin(ctx.from.id)) {
      await ctx.reply("✅ Xush kelibsiz, admin!", adminMenuKeyboard());
      return;
    }
    loginState.set(ctx.from.id, "");
    await ctx.reply(`🔐 Kodni kiriting:\n${maskCode("")}`, pinKeyboard());
  });

  bot.action(/^admin:pin:(\d)$/, async (ctx) => {
    if (isAdmin(ctx.from.id)) {
      await safeAnswerCbQuery(ctx);
      return;
    }
    let entered = loginState.get(ctx.from.id) || "";
    if (entered.length >= ADMIN_CODE.length) {
      await safeAnswerCbQuery(ctx);
      return;
    }
    entered += ctx.match[1];
    loginState.set(ctx.from.id, entered);
    await safeAnswerCbQuery(ctx);

    if (entered.length < ADMIN_CODE.length) {
      await safeEditMessageText(ctx, `🔐 Kodni kiriting:\n${maskCode(entered)}`, pinKeyboard());
      return;
    }

    if (entered === ADMIN_CODE) {
      addAdmin(ctx.from.id);
      loginState.delete(ctx.from.id);
      await safeEditMessageText(ctx, "✅ Kod to'g'ri! Admin sifatida tasdiqlandingiz.");
      await ctx.reply("Admin panel:", adminMenuKeyboard());
    } else {
      loginState.set(ctx.from.id, "");
      await safeEditMessageText(ctx, `❌ Noto'g'ri kod. Qaytadan urinib ko'ring:\n${maskCode("")}`, pinKeyboard());
    }
  });

  bot.action("admin:pin:back", async (ctx) => {
    if (isAdmin(ctx.from.id)) {
      await safeAnswerCbQuery(ctx);
      return;
    }
    const entered = (loginState.get(ctx.from.id) || "").slice(0, -1);
    loginState.set(ctx.from.id, entered);
    await safeAnswerCbQuery(ctx);
    await safeEditMessageText(ctx, `🔐 Kodni kiriting:\n${maskCode(entered)}`, pinKeyboard());
  });

  bot.hears(
    STATS_LABEL,
    requireAdmin(async (ctx) => {
      const entries = Object.values(getAllProfiles());
      const total = entries.length;
      const male = entries.filter((p) => p.gender === "male").length;
      const female = entries.filter((p) => p.gender === "female").length;
      const active = entries.filter((p) => p.active !== false).length;
      const premiumNow = entries.filter((p) => p.premiumUntil && new Date(p.premiumUntil) > new Date()).length;

      await ctx.reply(
        `📊 Statistika\n\n` +
          `👥 Jami: ${total}\n` +
          `👨 Erkak: ${male}\n` +
          `👩 Ayol: ${female}\n` +
          `🟢 Faol: ${active}\n` +
          `🔴 Faolsiz: ${total - active}\n` +
          `💎 Premium (hozir faol): ${premiumNow}`
      );
    })
  );

  bot.hears(
    USERS_LABEL,
    requireAdmin(async (ctx) => {
      await ctx.reply("🔍 Ism yoki Telegram ID bo'yicha qidiring:");
    })
  );

  // "Sotilgan akkauntlar" (private-chat unlock purchases) and "VIP kanallar"
  // aren't real, purchasable features yet (both are still placeholders
  // elsewhere in the bot) -- shown as not-yet-launched rather than
  // fabricating numbers for something nobody can actually buy.
  bot.hears(
    SALES_LABEL,
    requireAdmin(async (ctx) => {
      const premium = getSalesSummary();
      await ctx.reply(
        `💰 Sotuvlar hisoboti\n\n` +
          `💎 Premium obuna:\n` +
          `✅ Sotilgan: ${premium.count} ta\n` +
          `💵 Jami tushum: ${premium.totalRevenue.toLocaleString("uz-UZ")} so'm\n\n` +
          `🔐 Sotilgan akkauntlar (shaxsiy chat huquqi):\n` +
          `⏳ Hali ishga tushmagan\n\n` +
          `📢 VIP kanallar:\n` +
          `⏳ Hali ishga tushmagan`
      );
    })
  );

  // Registered after the hears() calls above, so it only catches text that
  // didn't match a menu button -- i.e. an actual search query.
  bot.on(
    "text",
    requireAdmin(async (ctx) => {
      const query = ctx.message.text.trim();
      if (!query) return;

      const all = getAllProfiles();
      const lowerQuery = query.toLowerCase();
      const matches = Object.entries(all)
        .filter(([id, p]) => id === query || (p.name && p.name.toLowerCase().includes(lowerQuery)))
        .slice(0, 15);

      if (matches.length === 0) {
        await ctx.reply("Hech kim topilmadi.");
        return;
      }

      for (const [id, profile] of matches) {
        await ctx.reply(userCard(id, profile), userActionsKeyboard(id, profile));
      }
    })
  );

  bot.action(
    /^admin:toggle:(.+)$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];
      const profile = getProfile(targetId);
      if (!profile) {
        await ctx.answerCbQuery("Topilmadi");
        return;
      }
      const newActive = profile.active === false;
      const updated = setProfileActive(targetId, newActive);
      await ctx.answerCbQuery(newActive ? "Faollashtirildi" : "Faolsizlantirildi");
      await ctx.editMessageText(userCard(targetId, updated), userActionsKeyboard(targetId, updated));
    })
  );

  bot.action(
    /^admin:delete:(.+)$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];
      deleteProfile(targetId);
      await ctx.answerCbQuery("O'chirildi");
      await ctx.editMessageText("🗑 Anketa o'chirildi.");
    })
  );

  bot.catch((err, ctx) => {
    console.error(`Admin bot error for update ${ctx.updateType}:`, err);
  });

  return bot;
}

module.exports = { createAdminBot };
