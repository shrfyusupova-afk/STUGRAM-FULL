const crypto = require("crypto");
const { Telegraf, Markup } = require("telegraf");
const {
  getAllProfiles, getProfile, setProfileActive, deleteProfile, isAdmin, addAdmin,
  listComplaints, getComplaint, setComplaintReply,
} = require("./db");
const { getSalesSummary } = require("./click");
const { deliverAdminReply } = require("./complaints");

// This file is committed to git -- a PIN hardcoded here would be readable
// by anyone with repo access, making the brute-force lockout below pointless
// (no guessing needed if you can just read the source). Prefers an env var;
// falls back to the old hardcoded value ONLY so an existing deploy doesn't
// lose admin access before ADMIN_PIN_CODE is actually set on the host --
// that fallback is itself insecure and logs a warning every time it's used.
const ADMIN_CODE = process.env.ADMIN_PIN_CODE || "19752901";
if (!process.env.ADMIN_PIN_CODE) {
  console.warn(
    "ADMIN_PIN_CODE is not set -- falling back to the default admin PIN, which is readable by " +
      "anyone with access to this repository's source code. Set ADMIN_PIN_CODE in your environment " +
      "to a private value as soon as possible."
  );
}
const STATS_LABEL = "📊 Statistika";
const USERS_LABEL = "👥 Foydalanuvchilar";
const SALES_LABEL = "💰 Sotuvlar";
const COMPLAINTS_LABEL = "🚨 Shikoyatlar";
const NEXT_LABEL = "➡️ Keyingisi";
const RESTART_LABEL = "🔄 Boshidan ko'rish";
const BACK_LABEL = "⬅️ Orqaga";

// What the reporter was looking at when they filed, used for the one-line
// label in the list so an admin can triage without opening each one.
const SOURCE_LABEL = {
  discover: "shubhali rasm shikoyati",
  anon: "anonim chatdan shikoyat",
  general: "umumiy shikoyat",
};

// In-memory only: which digits an unauthenticated user has entered so far.
// Resets on restart -- acceptable, it's just a login-attempt-in-progress
// cache, not anything that needs to survive a deploy.
const loginState = new Map();

// Global (not per-user) throttle on wrong-code attempts: the PIN is a single
// shared secret, not tied to any one identity, so a per-user lockout would be
// trivially bypassed by an attacker who forges a different from.id on every
// guess (possible if they're POSTing straight to the webhook rather than
// tapping real buttons). One wrong 8-digit code blocks ALL further attempts
// -- from anyone -- for LOCKOUT_MS, which turns a 10^8-combination brute
// force into a decades-long affair regardless of who's asking.
const LOCKOUT_MS = 30000;
let lockedOutUntil = 0;

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
  return Markup.keyboard([[STATS_LABEL, USERS_LABEL], [SALES_LABEL, COMPLAINTS_LABEL]]).resize();
}

// Shown while stepping through complaints one at a time.
function complaintNavKeyboard() {
  return Markup.keyboard([[NEXT_LABEL, BACK_LABEL], [RESTART_LABEL]]).resize();
}

// Where each admin currently is in the complaint list, and which complaint
// their next typed message should answer.
//
// In memory: it's a cursor over a list, not data. A restart just means the
// admin taps Shikoyatlar again and starts from the top -- nothing is lost,
// since replies are written straight to storage.
const complaintCursor = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// One line per complaint: the code the reporter was given, plus what kind of
// complaint it is, so the admin can pick one to jump straight to.
function complaintListText(complaints) {
  const lines = complaints.map((c) => {
    const mark = c.status === "answered" ? "✅" : "🆕";
    return `${mark} <code>${escapeHtml(c.id)}</code> — ${SOURCE_LABEL[c.source] || c.source}`;
  });
  return (
    `🚨 Shikoyatlar (${complaints.length} ta)\n\n` +
    `${lines.join("\n")}\n\n` +
    `Bittasini ochish uchun uning raqamini yuboring, yoki "${NEXT_LABEL}" bilan ketma-ket ko'ring.`
  );
}

// A person's details as the admin needs to see them: who they are, plus a tap
// target to message them directly. tg://user works for anyone who has talked
// to a bot, which both the reporter and the reported person have.
function personBlock(title, id, profile) {
  if (!id) return `${title}: —`;
  const link = `<a href="tg://user?id=${encodeURIComponent(id)}">✍️ To'g'ridan-to'g'ri yozish</a>`;
  if (!profile || !isRegistered(profile)) {
    return `${title}:\n🆔 <code>${escapeHtml(id)}</code> (anketa yo'q)\n${link}`;
  }
  return (
    `${title}:\n` +
    `👤 ${escapeHtml(profile.name)}, ${escapeHtml(profile.age)}\n` +
    `🆔 <code>${escapeHtml(id)}</code>\n` +
    `📍 ${escapeHtml(profile.location)}\n` +
    (profile.phone ? `📞 ${escapeHtml(profile.phone)}\n` : "") +
    `${link}`
  );
}

async function complaintDetailText(complaint, position, total) {
  const reporter = await getProfile(complaint.reporterId);
  const target = complaint.targetId ? await getProfile(complaint.targetId) : null;
  const when = complaint.createdAt ? new Date(complaint.createdAt).toISOString().slice(0, 16).replace("T", " ") : "—";

  return (
    `🚨 Shikoyat <code>${escapeHtml(complaint.id)}</code>  (${position}/${total})\n` +
    `📂 Turi: ${SOURCE_LABEL[complaint.source] || complaint.source}\n` +
    `🕒 ${when}\n` +
    `${complaint.status === "answered" ? "✅ Javob berilgan" : "🆕 Javob kutilmoqda"}\n\n` +
    `${personBlock("🙋 Kim shikoyat qilgan", complaint.reporterId, reporter)}\n\n` +
    `${personBlock("🎯 Kimning ustidan", complaint.targetId, target)}\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `💬 <b>Shikoyat matni:</b>\n${escapeHtml(complaint.text)}\n` +
    `━━━━━━━━━━━━━━\n\n` +
    (complaint.adminReply ? `📤 <b>Sizning javobingiz:</b>\n${escapeHtml(complaint.adminReply)}\n\n` : "") +
    `✍️ <b>Javobingizni yozing</b> — shu yerga yozsangiz, to'g'ridan-to'g'ri shikoyatchiga yetib boradi.`
  );
}

// Wraps a handler so it silently no-ops for anyone not in data/admins.json --
// no error, no hint that anything exists, just nothing happens.
function requireAdmin(handler) {
  return async (ctx) => {
    if (!(await isAdmin(ctx.from.id))) return;
    return handler(ctx);
  };
}

// A record can exist with only an entitlement on it (someone paid before
// finishing -- or after deleting -- their anketa), so every displayed field
// has to tolerate being absent instead of rendering "undefined".
function isRegistered(profile) {
  return !!profile?.name;
}

function userCard(id, profile) {
  const status = profile.active === false ? "🔴 Faolsiz" : "🟢 Faol";
  const premium =
    profile.premiumUntil && new Date(profile.premiumUntil) > new Date()
      ? `\n💎 Premium: ${new Date(profile.premiumUntil).toISOString().slice(0, 10)} gacha`
      : "";

  if (!isRegistered(profile)) {
    return `👤 (anketa to'ldirilmagan — faqat to'lov yozuvi)\n🆔 ${id}${premium}`;
  }

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

// mainBotTelegram is the MAIN bot's Telegram client, not this one's. A reply
// to a complaint has to reach the reporter in the bot they actually use --
// sending it from the admin bot would land in a chat they've never opened.
function createAdminBot(token, mainBotTelegram) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    if (await isAdmin(ctx.from.id)) {
      await ctx.reply("✅ Xush kelibsiz, admin!", adminMenuKeyboard());
      return;
    }
    loginState.set(ctx.from.id, "");
    await ctx.reply(`🔐 Kodni kiriting:\n${maskCode("")}`, pinKeyboard());
  });

  bot.action(/^admin:pin:(\d)$/, async (ctx) => {
    if (await isAdmin(ctx.from.id)) {
      await safeAnswerCbQuery(ctx);
      return;
    }

    if (Date.now() < lockedOutUntil) {
      const secondsLeft = Math.ceil((lockedOutUntil - Date.now()) / 1000);
      await safeAnswerCbQuery(ctx, `⏳ ${secondsLeft}s kuting`);
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

    if (crypto.timingSafeEqual(Buffer.from(entered), Buffer.from(ADMIN_CODE))) {
      await addAdmin(ctx.from.id);
      loginState.delete(ctx.from.id);
      await safeEditMessageText(ctx, "✅ Kod to'g'ri! Admin sifatida tasdiqlandingiz.");
      await ctx.reply("Admin panel:", adminMenuKeyboard());
    } else {
      loginState.set(ctx.from.id, "");
      lockedOutUntil = Date.now() + LOCKOUT_MS;
      await safeEditMessageText(
        ctx,
        `❌ Noto'g'ri kod. ${LOCKOUT_MS / 1000} soniyadan keyin qayta urinib ko'ring:\n${maskCode("")}`,
        pinKeyboard()
      );
    }
  });

  bot.action("admin:pin:back", async (ctx) => {
    if (await isAdmin(ctx.from.id)) {
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
      const entries = Object.values(await getAllProfiles());
      // Anketa counts only cover real registered profiles -- a record holding
      // nothing but a paid entitlement isn't a user with an anketa and would
      // otherwise silently inflate "Jami" and "Faol". Premium is counted over
      // everyone, since such a person IS a paying customer either way.
      const registered = entries.filter(isRegistered);
      const total = registered.length;
      const male = registered.filter((p) => p.gender === "male").length;
      const female = registered.filter((p) => p.gender === "female").length;
      const active = registered.filter((p) => p.active !== false).length;
      const premiumNow = entries.filter((p) => p.premiumUntil && new Date(p.premiumUntil) > new Date()).length;
      const pendingAnketa = entries.length - total;

      await ctx.reply(
        `📊 Statistika\n\n` +
          `👥 Jami: ${total}\n` +
          `👨 Erkak: ${male}\n` +
          `👩 Ayol: ${female}\n` +
          `🟢 Faol: ${active}\n` +
          `🔴 Faolsiz: ${total - active}\n` +
          `💎 Premium (hozir faol): ${premiumNow}` +
          (pendingAnketa > 0 ? `\n\n⚠️ Anketasiz to'lov yozuvlari: ${pendingAnketa}` : "")
      );
    })
  );

  bot.hears(
    USERS_LABEL,
    requireAdmin(async (ctx) => {
      await ctx.reply("🔍 Ism yoki Telegram ID bo'yicha qidiring:");
    })
  );

  // Premium, per-profile unlocks, and VIP chat access are all real Click
  // purchases now.
  bot.hears(
    SALES_LABEL,
    requireAdmin(async (ctx) => {
      const sales = await getSalesSummary();
      await ctx.reply(
        `💰 Sotuvlar hisoboti\n\n` +
          `💎 Premium obuna:\n` +
          `✅ Sotilgan: ${sales.premium.count} ta\n` +
          `💵 Jami tushum: ${sales.premium.totalRevenue.toLocaleString("uz-UZ")} so'm\n\n` +
          `🔐 Sotilgan akkauntlar (profil ko'rish, 7 900 so'm/dona):\n` +
          `✅ Sotilgan: ${sales.unlock.count} ta\n` +
          `💵 Jami tushum: ${sales.unlock.totalRevenue.toLocaleString("uz-UZ")} so'm\n\n` +
          `📢 VIP chat (yigitlar, 59 900 so'm/dona):\n` +
          `✅ Sotilgan: ${sales.vipchat.count} ta\n` +
          `💵 Jami tushum: ${sales.vipchat.totalRevenue.toLocaleString("uz-UZ")} so'm\n\n` +
          `🕵️ Anonim chat -- jins tanlash (haftalik, 12 900 so'm):\n` +
          `✅ Sotilgan: ${sales.anongender.count} ta\n` +
          `💵 Jami tushum: ${sales.anongender.totalRevenue.toLocaleString("uz-UZ")} so'm`
      );
    })
  );

  // Opens the list and puts the admin at the top of it.
  bot.hears(
    COMPLAINTS_LABEL,
    requireAdmin(async (ctx) => {
      const complaints = await listComplaints();
      if (complaints.length === 0) {
        complaintCursor.delete(ctx.from.id);
        await ctx.reply("🚨 Hozircha shikoyatlar yo'q.", adminMenuKeyboard());
        return;
      }
      complaintCursor.set(ctx.from.id, { ids: complaints.map((c) => c.id), index: 0, viewing: null });
      await ctx.reply(complaintListText(complaints), { parse_mode: "HTML", ...complaintNavKeyboard() });
      await showComplaintAt(ctx, 0);
    })
  );

  // Re-reads the list from storage each time rather than trusting the cursor's
  // snapshot, so a complaint filed since the admin opened the list still shows
  // up and a deleted one doesn't 404.
  async function showComplaintAt(ctx, index) {
    const complaints = await listComplaints();
    if (complaints.length === 0) {
      complaintCursor.delete(ctx.from.id);
      await ctx.reply("🚨 Shikoyatlar tugadi.", adminMenuKeyboard());
      return;
    }
    const bounded = Math.max(0, Math.min(index, complaints.length - 1));
    const complaint = complaints[bounded];
    complaintCursor.set(ctx.from.id, {
      ids: complaints.map((c) => c.id),
      index: bounded,
      viewing: complaint.id,
    });
    await ctx.reply(await complaintDetailText(complaint, bounded + 1, complaints.length), {
      parse_mode: "HTML",
      ...complaintNavKeyboard(),
    });
  }

  bot.hears(
    NEXT_LABEL,
    requireAdmin(async (ctx) => {
      const cursor = complaintCursor.get(ctx.from.id);
      if (!cursor) {
        await ctx.reply(`Avval "${COMPLAINTS_LABEL}" tugmasini bosing.`, adminMenuKeyboard());
        return;
      }
      const nextIndex = cursor.index + 1;
      if (nextIndex >= cursor.ids.length) {
        complaintCursor.delete(ctx.from.id);
        await ctx.reply("✅ Barcha shikoyatlarni ko'rib chiqdingiz.", adminMenuKeyboard());
        return;
      }
      await showComplaintAt(ctx, nextIndex);
    })
  );

  bot.hears(
    RESTART_LABEL,
    requireAdmin(async (ctx) => {
      await showComplaintAt(ctx, 0);
    })
  );

  bot.hears(
    BACK_LABEL,
    requireAdmin(async (ctx) => {
      complaintCursor.delete(ctx.from.id);
      await ctx.reply("Admin panel:", adminMenuKeyboard());
    })
  );

  // Registered after the hears() calls above, so it only catches text that
  // didn't match a menu button -- i.e. a complaint id, a reply, or a search.
  bot.on(
    "text",
    requireAdmin(async (ctx) => {
      const query = ctx.message.text.trim();
      if (!query) return;

      // Jumping straight to a complaint by the code the reporter was given.
      if (/^\d{5}$/.test(query)) {
        const complaint = await getComplaint(query);
        if (complaint) {
          const all = await listComplaints();
          await showComplaintAt(ctx, all.findIndex((c) => c.id === complaint.id));
          return;
        }
        // Not a complaint code -- fall through and treat it as a search term,
        // since a 5-digit Telegram id is unlikely but a typo'd code is not.
      }

      // While a complaint is open on screen, anything typed is the answer to
      // it. That is the whole "javobingizni yozing" box.
      const cursor = complaintCursor.get(ctx.from.id);
      if (cursor?.viewing) {
        const updated = await setComplaintReply(cursor.viewing, query);
        if (!updated) {
          await ctx.reply("Bu shikoyat topilmadi (o'chirilgan bo'lishi mumkin).");
          return;
        }
        try {
          await deliverAdminReply(mainBotTelegram, updated);
          await ctx.reply(
            `✅ Javob yuborildi.\n🆔 Shikoyat: ${updated.id}\n👤 Qabul qildi: ${updated.reporterId}`,
            complaintNavKeyboard()
          );
        } catch (err) {
          // Saved either way -- only the delivery failed, and the admin needs
          // to know that so they can reach the person another way.
          console.error("complaint reply delivery failed:", err.message);
          await ctx.reply(
            `⚠️ Javob saqlandi, lekin foydalanuvchiga yetkazib bo'lmadi ` +
              `(botni bloklagan bo'lishi mumkin).\n🆔 ${updated.id}`,
            complaintNavKeyboard()
          );
        }
        return;
      }

      const all = await getAllProfiles();
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
      const profile = await getProfile(targetId);
      if (!profile) {
        await safeAnswerCbQuery(ctx, "Topilmadi");
        return;
      }
      const newActive = profile.active === false;
      const updated = await setProfileActive(targetId, newActive);
      await safeAnswerCbQuery(ctx, newActive ? "Faollashtirildi" : "Faolsizlantirildi");
      await safeEditMessageText(ctx, userCard(targetId, updated), userActionsKeyboard(targetId, updated));
    })
  );

  bot.action(
    /^admin:delete:(.+)$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];
      await deleteProfile(targetId);
      await safeAnswerCbQuery(ctx, "O'chirildi");
      await safeEditMessageText(ctx, "🗑 Anketa o'chirildi.");
    })
  );

  bot.catch((err, ctx) => {
    console.error(`Admin bot error for update ${ctx.updateType}:`, err);
  });

  return bot;
}

module.exports = { createAdminBot };
