const crypto = require("crypto");
const { Telegraf, Markup } = require("telegraf");
const {
  searchProfiles, getProfileStats, listAllProfileIds,
  getProfile, setProfileActive, deleteProfile, isAdmin, addAdmin, listAdmins, removeAdmin,
  listComplaints, getComplaint, setComplaintReply,
  setPremiumUntil, hasPremium, grantVipChat, hasVipChat,
  setAnonGenderFilterUntil, addUnlockCredits,
  topReferrers, countReferrals,
  countPendingLikers, getLikeNoticeAt,
  listNewProfilesSince,
  setAdActive,
} = require("./db");
const { getOrder, createOrder, priceForType } = require("./orders");
const { somToTiyin, ACCOUNT_FIELD, buildCheckoutUrl } = require("./payme");
const {
  getSalesSummary,
  PREMIUM_PRICE_SOM,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  PREMIUM_DAYS,
  ANON_GENDER_DAYS,
  extendFrom,
} = require("./click");
const { VIP_CHAT_INVITE_LINK } = require("./vipChat");
const { deliverAdminReply } = require("./complaints");
const { profileLinkHref, profileLinkKind } = require("./profileLink");
const { isRegistered } = require("./profileState");
const { fetchProfileMedia, replyWithProfileMedia } = require("./adminMedia");
const { isGoneError, retryAfterMs } = require("./telegramSafety");
const { floodGuardMiddleware } = require("./floodGuard");
const { alert } = require("./alerts");
const { isConfigured: aiConfigured, askAdminAssistant, buildDataSnapshot } = require("./aiAssistant");
const {
  notifyAccountDeleted,
  notifyAccountDeactivated,
  notifyAccountReactivated,
} = require("./accountNotices");

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
const BROADCAST_LABEL = "📢 Reklama berish";
const REPORT_LABEL = "📈 To'liq hisobot";
const REFERRALS_LABEL = "🏆 Takliflar statistikasi";
const TODAY_LABEL = "📅 Bugun qo'shilganlar";
const GIFT_ALL_LABEL = "🎁 Hammaga ehson";
const AI_LABEL = "🤖 AI yordamchi";
const LOGOUT_LABEL = "🚪 Admin bo'lishdan chiqish";
const NEXT_LABEL = "➡️ Keyingisi";
const RESTART_LABEL = "🔄 Boshidan ko'rish";
const BACK_LABEL = "⬅️ Orqaga";
const CONFIRM_YES_LABEL = "✅ Ha, yuborilsin";
const CONFIRM_NO_LABEL = "❌ Yo'q, bekor qilish";
const SKIP_MEDIA_LABEL = "⏭ Rasmsiz davom etish";

// How many free profile unlocks one tap of the gift button hands over. One,
// so the size of the gift is decided by how many times it is tapped rather
// than fixed here -- five was the only amount possible, which made it the
// wrong amount most of the time.
const GIFT_UNLOCK_CREDITS = 1;

// What the reporter was looking at when they filed, used for the one-line
// label in the list so an admin can triage without opening each one.
const SOURCE_LABEL = {
  discover: "profil ustidan shikoyat",
  anon: "anonim chatdan shikoyat",
  general: "umumiy shikoyat",
};

// In-memory only: which digits an unauthenticated user has entered so far.
// Resets on restart -- acceptable, it's just a login-attempt-in-progress
// cache, not anything that needs to survive a deploy.
const loginState = new Map();

// Being IN the admins table (isAdmin) and being LOGGED IN right now are two
// different questions. The table answers "is this person allowed to be an
// admin at all" and is permanent, changed only by entering the PIN once or by
// another admin using "Admin huquqini bekor qilish". This map answers "have
// they proven it recently" and expires on its own -- so the PIN having leaked
// once, or a laptop left open, doesn't grant standing access forever. Reset
// on restart is fine here too: a redeploy simply asks every admin to type the
// PIN again, which is the safe direction to fail in.
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const adminSessions = new Map(); // userId -> last authenticated at (ms)

// Keyed by String(userId) throughout -- ctx.from.id arrives as a number from
// Telegraf, but a demoted admin's id arrives as a string (a regex capture
// from callback_data), and Map.get() requires an exact key match. Without
// coercion, ending a demoted admin's session here would silently miss the
// entry stored under the numeric key.
function sessionValid(userId) {
  const at = adminSessions.get(String(userId));
  return !!at && Date.now() - at < ADMIN_SESSION_TTL_MS;
}

function startSession(userId) {
  adminSessions.set(String(userId), Date.now());
}

function endSession(userId) {
  adminSessions.delete(String(userId));
}

// Wrong-code throttling.
//
// This was global, which made it a denial-of-service: one stranger entering a
// wrong code locked every real admin out, and repeating it locked them out
// permanently. It is now per-user, with the delay growing on each successive
// wrong attempt by that same user, so an attacker can only ever lock out
// themselves.
//
// Forging a different from.id per guess to dodge the per-user limit would
// mean POSTing straight at the webhook, which requires the secret token that
// index.js now always enforces. The global ceiling below is a second line of
// defence against that, set high enough that ordinary admins never meet it.
const LOCKOUT_BASE_MS = 5000;
const LOCKOUT_MAX_MS = 5 * 60 * 1000;
const failedAttempts = new Map(); // userId -> { count, until }

// A global brute-force ceiling that does NOT deny service: it only starts
// biting after far more wrong codes than a person would ever type, and it
// slows rather than blocks.
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_MAX_PER_WINDOW = 100;
let globalWindowStart = Date.now();
let globalAttempts = 0;

// loginState and failedAttempts both gain one entry per Telegram id that
// ever taps /start or gets a digit wrong here, and neither is ever removed
// on its own -- only a SUCCESSFUL login clears them (see the "Kod to'g'ri!"
// branch below). A stranger who finds this bot's username, sees the PIN
// screen, and never comes back leaves an entry that would otherwise sit
// forever; the same is true of anyone who ever fails a guess, which by
// definition includes almost every attacker. Same unbounded-growth shape
// already fixed in floodGuard.js, index.js's username/last-seen caches, and
// searchState below -- missed here until now.
const LOGIN_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
// Grace period AFTER an entry's own lockout has already ended, so a sweep
// can never cut a currently-active lockout short and let an attacker back in
// early.
const FAILED_ATTEMPT_SWEEP_GRACE_MS = 60 * 60 * 1000;

function sweepLoginState(now = Date.now()) {
  // loginState carries no timestamp of its own -- it is just "digits typed
  // so far" for whoever is mid-entry right now. Safe to drop in bulk, same
  // as index.js's username cache: the only cost is a real admin who happens
  // to be typing their PIN at this exact moment starting over.
  loginState.clear();
  let removed = 0;
  for (const [userId, entry] of failedAttempts) {
    if (now - entry.until > FAILED_ATTEMPT_SWEEP_GRACE_MS) {
      failedAttempts.delete(userId);
      removed++;
    }
  }
  return removed;
}

setInterval(sweepLoginState, LOGIN_SWEEP_INTERVAL_MS).unref();

function lockoutRemainingMs(userId) {
  const entry = failedAttempts.get(userId);
  if (!entry) return 0;
  return Math.max(0, entry.until - Date.now());
}

function recordFailedAttempt(userId) {
  const entry = failedAttempts.get(userId) || { count: 0, until: 0 };
  entry.count++;
  // 5s, 10s, 20s, 40s ... capped at five minutes.
  const delay = Math.min(LOCKOUT_BASE_MS * 2 ** (entry.count - 1), LOCKOUT_MAX_MS);
  entry.until = Date.now() + delay;
  failedAttempts.set(userId, entry);
  return delay;
}

function globalRateLimited() {
  const now = Date.now();
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalAttempts = 0;
  }
  globalAttempts++;
  return globalAttempts > GLOBAL_MAX_PER_WINDOW;
}

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
  return Markup.keyboard([
    [STATS_LABEL, USERS_LABEL],
    [SALES_LABEL, COMPLAINTS_LABEL],
    [REPORT_LABEL, AI_LABEL],
    [REFERRALS_LABEL, TODAY_LABEL],
    [BROADCAST_LABEL, GIFT_ALL_LABEL],
    [LOGOUT_LABEL],
  ]).resize();
}

// What anyone who is NOT already a proven admin sees on /start -- an ordinary
// FAQ screen about the product, not an obvious "type the admin code" prompt.
// Anyone who finds this bot's username and taps it should see a harmless
// public-facing screen, not a signal that this is the admin panel worth
// attacking. Real access is unaffected either way: the PIN, the per-user
// lockout and the global ceiling all still apply exactly as before once
// /iamadmin actually reveals the code pad -- this only changes what a
// stranger sees before that.
const FAQ_WHAT_LABEL = "ForOne - nima?";
const FAQ_FOUNDER_LABEL = "ForOne - asoschisi kim?";
const FAQ_PRICING_LABEL = "ForOne - hizmatlari narxi?";

function faqKeyboard() {
  return Markup.keyboard([[FAQ_WHAT_LABEL], [FAQ_FOUNDER_LABEL], [FAQ_PRICING_LABEL]]).resize();
}

const FAQ_INTRO_TEXT = "👋 ForOne botiga xush kelibsiz!\n\nSavolingizga javob olish uchun pastdagi tugmalardan birini tanlang.";

const FAQ_WHAT_TEXT =
  "💛 ForOne — odamlarni bir-biri bilan tanishtiruvchi, do'stlik va jiddiy munosabatlar qurishga yordam beruvchi tanishuv xizmati.\n\n" +
  "Anketa yaratib, boshqa foydalanuvchilar bilan tanishishingiz, layk bosishingiz va suhbatlashishingiz mumkin.";

// TODO: placeholder -- swap for the real answer once it's provided.
const FAQ_FOUNDER_TEXT =
  "ForOne kichik va ishtiyoqli jamoa tomonidan yaratilgan — maqsadimiz odamlarga chin muhabbat va do'stlik topishda yordam berish.";

const FAQ_PRICING_TEXT =
  "💳 ForOne'dagi xizmatlar narxi:\n\n" +
  `🔐 Anketani ochish: ${UNLOCK_PRICE_SOM.toLocaleString("uz-UZ")} so'm\n` +
  `👑 Premium: ${PREMIUM_PRICE_SOM.toLocaleString("uz-UZ")} so'm\n` +
  `💎 VIP suhbat: ${VIP_CHAT_PRICE_SOM.toLocaleString("uz-UZ")} so'm\n` +
  `🕵️ Anonim chatda jins tanlash: ${ANON_GENDER_PRICE_SOM.toLocaleString("uz-UZ")} so'm`;

// Where each admin currently is in the complaint list, and which complaint
// their next typed message should answer.
//
// In memory: it's a cursor over a list, not data. A restart just means the
// admin taps Shikoyatlar again and starts from the top -- nothing is lost,
// since replies are written straight to storage.
const complaintCursor = new Map();

// --- Broadcast -------------------------------------------------------------
//
// Composing an advert, one step at a time: media -> caption -> preview ->
// confirm. Held in memory because it's a half-finished draft, not data; the
// worst a restart costs is retyping it.
// adminId -> { step: "media"|"text"|"confirm", fileId, mediaType, text }
const broadcastDraft = new Map();

// A gift being composed for EVERYONE: which gift, and the note that goes with
// it. Same shape and lifetime as broadcastDraft -- one at a time per admin,
// cleared by leaveComposers, never persisted, because an abandoned
// half-written gift must not be resumable by accident.
const giftAllDraft = new Map();

// Admins who tapped "AI yordamchi" and are now in an open chat with it --
// every text message they send is a question (or a follow-up) until they
// tap Orqaga, not a search term or a complaint reply.
const aiAwaiting = new Set();
// adminId -> [{role, content}, ...] -- the running chat transcript, so the
// assistant remembers earlier turns in the same conversation. Trimmed by
// askAdminAssistant itself; cleared whenever the chat is left.
const aiHistory = new Map();

// Leaving any sub-screen: a half-composed advert, a complaint cursor, and an
// open AI chat must not survive a jump to another part of the panel, or the
// next thing typed would be swallowed by whichever flow was left dangling.
function leaveComposers(adminId) {
  broadcastDraft.delete(adminId);
  giftAllDraft.delete(adminId);
  complaintCursor.delete(adminId);
  aiAwaiting.delete(adminId);
  aiHistory.delete(adminId);
}

function cancelKeyboard() {
  return Markup.keyboard([[BACK_LABEL]]).resize();
}

function confirmKeyboard() {
  return Markup.keyboard([[CONFIRM_YES_LABEL, CONFIRM_NO_LABEL]]).resize();
}

// Telegram allows roughly 30 messages per second across different chats, and
// punishes sustained bursts above it. Pacing at ~20/sec leaves headroom for
// everything else the bot is doing at the same time.
const BROADCAST_GAP_MS = 50;

// Runs in the background and reports back when finished. Deliberately NOT
// awaited by the handler: a broadcast to thousands of people takes minutes,
// and the admin's chat (and the rest of the bot) must stay responsive
// throughout.
// The advert's photo/video was uploaded to the ADMIN bot, but the broadcast
// goes out through the MAIN bot -- which cannot use that file id, exactly the
// same rule that was hiding profile photos from the admin panel, in the
// opposite direction. Every media broadcast would have failed for every
// recipient.
//
// So the bytes are pulled down once through the bot that owns them, uploaded
// with the FIRST message, and the file id the main bot hands back is reused
// for everyone after that: one upload for the whole run, not one per person.
function fileIdFromSentMessage(message) {
  if (message?.video?.file_id) return message.video.file_id;
  if (Array.isArray(message?.photo) && message.photo.length) {
    return message.photo[message.photo.length - 1].file_id;
  }
  return null;
}

async function runBroadcast(mainBotTelegram, adminChatId, adminTelegram, draft, recipients) {
  let sent = 0;
  let blocked = 0;
  let failed = 0;
  let lastProgressAt = Date.now();

  // Starts as the bytes; becomes a main-bot file id after the first success.
  let media = null;
  if (draft.fileId) {
    try {
      media = { source: await fetchProfileMedia(adminTelegram, draft.fileId) };
    } catch (err) {
      try {
        await adminTelegram.sendMessage(
          adminChatId,
          `❌ Reklama yuborilmadi — rasm/videoni o'qib bo'lmadi.\n<code>${escapeHtml(err.message)}</code>`,
          { parse_mode: "HTML" }
        );
      } catch {
        /* nothing further to do */
      }
      return;
    }
  }

  const deliverTo = async (userId) => {
    if (draft.fileId) {
      const method = draft.mediaType === "video" ? "sendVideo" : "sendPhoto";
      const message = await mainBotTelegram[method](userId, media, {
        caption: draft.text,
        parse_mode: "HTML",
      });
      // Swap the upload for the id it produced, so the remaining recipients
      // cost one API call each instead of a re-upload.
      if (typeof media !== "string") media = fileIdFromSentMessage(message) || media;
    } else {
      await mainBotTelegram.sendMessage(userId, draft.text, { parse_mode: "HTML" });
    }
  };

  for (const userId of recipients) {
    try {
      await deliverTo(userId);
      sent++;
    } catch (err) {
      if (isGoneError(err)) {
        // Blocked the bot, deleted their account, never started it. Expected
        // across a large audience and no reason to stop.
        blocked++;
        continue;
      }
      // Being told to slow down is NOT the same as being blocked, and this
      // used to be counted as one. Two things went wrong at once: the message
      // was dropped, and the summary told the admin that N people had blocked
      // the bot when Telegram had simply throttled us -- a comfortable lie
      // that hides a broadcast which mostly did not arrive.
      const wait = retryAfterMs(err);
      if (wait) {
        await new Promise((resolve) => setTimeout(resolve, wait));
        try {
          await deliverTo(userId);
          sent++;
          continue;
        } catch (retryErr) {
          if (isGoneError(retryErr)) {
            blocked++;
            continue;
          }
        }
      }
      failed++;
    }

    // A long broadcast is otherwise silent for minutes; a line every 30s
    // shows it is still moving.
    if (Date.now() - lastProgressAt > 30000) {
      lastProgressAt = Date.now();
      try {
        await adminTelegram.sendMessage(adminChatId, `📤 Yuborilmoqda... ${sent + blocked + failed}/${recipients.length}`);
      } catch {
        /* progress is a nicety; never let it break the run */
      }
    }

    await new Promise((resolve) => setTimeout(resolve, BROADCAST_GAP_MS));
  }

  try {
    await adminTelegram.sendMessage(
      adminChatId,
      `✅ Reklama yuborildi!\n\n` +
        `📬 Yetkazildi: ${sent} ta\n` +
        `🚫 Botni bloklagan: ${blocked} ta\n` +
        `⚠️ Xatolik tufayli yetmadi: ${failed} ta\n` +
        `👥 Jami: ${recipients.length} ta`,
      adminMenuKeyboard()
    );
  } catch (err) {
    console.error("broadcast summary failed:", err.message);
  }
  console.log(`Broadcast finished: ${sent} delivered, ${blocked} blocked, ${failed} failed, ${recipients.length} total`);
}

// Grants the gift to everyone and tells them, one at a time and paced.
//
// Two failures are counted separately on purpose. A grant that fails is a
// person who did NOT get what was promised; a message that fails is a person
// who got it and does not know. The first is a bug to chase, the second is
// mostly people who blocked the bot -- reporting them as one number would
// hide the first behind the second.
//
// The grant always comes before the message: if the order were reversed, a
// crash in between would leave somebody told about a gift they never got.
async function runGiftAll(mainBotTelegram, adminChatId, adminTelegram, draft, recipients) {
  let granted = 0;
  let notified = 0;
  let blocked = 0;
  let grantFailed = 0;
  let lastProgressAt = Date.now();

  const text = giftAllMessage(draft.kind, draft.note);

  const grantTo = async (userId) => {
    if (draft.kind === "credits") {
      await addUnlockCredits(userId, GIFT_UNLOCK_CREDITS);
      return;
    }
    if (draft.kind === "vip") {
      await grantVipChat(userId);
      return;
    }
    // Premium and the anon filter both EXTEND rather than replace, so nobody
    // with time already on the clock loses any of it to a gift.
    const profile = await getProfile(userId);
    if (draft.kind === "premium") {
      await setPremiumUntil(userId, extendFrom(profile?.premiumUntil, PREMIUM_DAYS));
      return;
    }
    await setAnonGenderFilterUntil(userId, extendFrom(profile?.anonGenderUntil, ANON_GENDER_DAYS));
  };

  for (const userId of recipients) {
    try {
      await grantTo(userId);
      granted++;
    } catch (err) {
      grantFailed++;
      console.error(`gift-all grant failed for ${userId}:`, err.message);
      // Nothing was given, so say nothing -- a message about a gift that did
      // not arrive is worse than silence.
      continue;
    }

    try {
      await mainBotTelegram.sendMessage(userId, text, { parse_mode: "HTML" });
      notified++;
    } catch (err) {
      if (isGoneError(err)) {
        // They blocked the bot or deleted their account. The gift is still
        // recorded and waiting for them if they ever come back.
        blocked++;
      } else {
        const wait = retryAfterMs(err);
        if (wait) {
          await new Promise((resolve) => setTimeout(resolve, wait));
          try {
            await mainBotTelegram.sendMessage(userId, text, { parse_mode: "HTML" });
            notified++;
          } catch (retryErr) {
            if (isGoneError(retryErr)) blocked++;
            else console.error(`gift-all notify failed for ${userId}:`, retryErr.message);
          }
        } else {
          console.error(`gift-all notify failed for ${userId}:`, err.message);
        }
      }
    }

    if (Date.now() - lastProgressAt > 30000) {
      lastProgressAt = Date.now();
      try {
        await adminTelegram.sendMessage(adminChatId, `🎁 Tarqatilmoqda... ${granted + grantFailed}/${recipients.length}`);
      } catch {
        /* progress is a nicety; never let it break the run */
      }
    }

    await new Promise((resolve) => setTimeout(resolve, BROADCAST_GAP_MS));
  }

  try {
    await adminTelegram.sendMessage(
      adminChatId,
      `✅ Ehson tarqatildi!\n\n` +
        `🎁 Berildi: ${granted} ta\n` +
        `📬 Xabar yetdi: ${notified} ta\n` +
        `🚫 Botni bloklagan (sovg'asi saqlanib qoldi): ${blocked} ta\n` +
        (grantFailed ? `⚠️ Berib bo'lmadi: ${grantFailed} ta\n` : "") +
        `👥 Jami: ${recipients.length} ta`,
      adminMenuKeyboard()
    );
  } catch (err) {
    console.error("gift-all summary failed:", err.message);
  }
  console.log(
    `Gift-all (${draft.kind}) finished: ${granted} granted, ${notified} notified, ${blocked} blocked, ${grantFailed} failed`
  );
}

// Shown while stepping through complaints one at a time.
function complaintNavKeyboard() {
  return Markup.keyboard([[NEXT_LABEL, BACK_LABEL], [RESTART_LABEL]]).resize();
}

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

// How to reach this person in one tap. profileLink.js decides which form of
// link actually works; this only words it.
function contactLine(id, profile) {
  const href = profileLinkHref(id, profile);
  const kind = profileLinkKind(profile);

  if (kind === "username") {
    return `✍️ <a href="${href}">@${escapeHtml(profile.username)} — yozish</a>`;
  }
  if (kind === "phone") {
    return (
      `✍️ <a href="${href}">To'g'ridan-to'g'ri yozish</a>\n` +
      `📱 Raqam: <code>${escapeHtml(profile.phone)}</code>`
    );
  }
  return (
    `✍️ <a href="${href}">To'g'ridan-to'g'ri yozish</a>\n` +
    `<i>(username ham, raqam ham yo'q — havola ochilmasligi mumkin)</i>`
  );
}

// A person's details as the admin needs to see them.
function personBlock(title, id, profile) {
  if (!id) return `${title}: —`;
  if (!profile || !isRegistered(profile)) {
    return `${title}:\n🆔 <code>${escapeHtml(id)}</code> (anketa yo'q)\n${contactLine(id, profile)}`;
  }
  return (
    `${title}:\n` +
    `👤 ${escapeHtml(profile.name)}, ${escapeHtml(profile.age)}\n` +
    `🆔 <code>${escapeHtml(id)}</code>\n` +
    `📍 ${escapeHtml(profile.location)}\n` +
    (profile.phone ? `📞 ${escapeHtml(profile.phone)}\n` : "") +
    `${contactLine(id, profile)}`
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
    // A session that has expired is caught HERE, not only at /start -- so
    // whatever the admin taps next (a search, a broadcast step, anything)
    // is what re-prompts for the PIN, rather than quietly running on a
    // session that has been stale for hours.
    if (!sessionValid(ctx.from.id)) {
      leaveComposers(ctx.from.id);
      loginState.set(ctx.from.id, "");
      await ctx.reply(
        `⏳ Sessiya muddati tugadi (12 soatdan ko'p vaqt o'tdi). Davom etish uchun kodni qayta kiriting:\n${maskCode("")}`,
        pinKeyboard()
      );
      return;
    }
    return handler(ctx);
  };
}

function dateOnly(iso) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : null;
}

// Everything stored about this person, so a search result answers whatever
// the admin was actually looking for without further digging.
// How many people this person brought in, ready to drop into a card.
//
// Same number as the leaderboard: invitees who FINISHED registering, not
// people who merely opened the link. Counted rather than guessed from the
// reward balance -- unlock credits get spent, so a balance of zero says
// nothing about whether somebody invited thirty people. A failure here
// degrades to no line at all: a referral count is not worth failing to open
// somebody's profile over.
async function referralLine(id) {
  let registered = 0;
  try {
    registered = await countReferrals(id, { rewardedOnly: true });
  } catch (err) {
    console.error(`Could not count referrals for ${id}:`, err.message);
    return "";
  }
  if (registered === 0) return `🎁 Taklif qilgan: yo'q`;
  return `🎁 Taklif qilgan: <b>${registered}</b> ta (ro'yxatdan o'tgan)`;
}

// The two numbers behind "why didn't this person get the 'N people liked you'
// message?".
//
// `pending` is not the raw like count -- it is how many likers are still
// WAITING on an answer. Someone who has already liked all three of their
// admirers back has a pending count of zero and is correctly told nothing
// (those became matches instead), which is the single most common reason the
// milestone message appears not to work. `announced` is the last milestone
// already sent, so the next message is due at the next multiple of three
// above it. Both are unreadable from inside the bot; here they are one tap.
async function likesLine(id) {
  try {
    const [pending, announced] = await Promise.all([countPendingLikers(id), getLikeNoticeAt(id)]);
    return (
      `💛 Javob kutayotgan layklar: <b>${pending}</b>` +
      `  •  oxirgi xabar: ${announced || "yo'q"}`
    );
  } catch (err) {
    console.error(`Could not read like state for ${id}:`, err.message);
    return "";
  }
}

// Gender, and what it MEANS for this person -- which is the thing anyone
// actually wants to know when they ask "why is browsing showing me men?".
//
// The card used to print genderLabel and fall back to gender. Those are two
// separate stored fields: the label is display text, the raw value is what
// the candidate query filters on. Showing only the label hid exactly the case
// worth catching, where the two disagree. So both appear, plus the
// consequence spelled out, because the raw value alone still needs decoding.
function genderLine(profile) {
  const raw = profile.gender;
  const label = profile.genderLabel || raw || "—";
  if (raw !== "male" && raw !== "female") {
    return `${escapeHtml(label)} — ⚠️ saqlangan qiymat: <code>${escapeHtml(String(raw ?? "yo'q"))}</code>`;
  }
  const shows = raw === "male" ? "ayollar" : "erkaklar";
  return `${escapeHtml(label)} (<code>${raw}</code>) → tanishuvlarda <b>${shows}</b> ko'rsatiladi`;
}

async function userCard(id, profile) {
  const invites = await referralLine(id);
  const likes = await likesLine(id);
  const premiumUntil = dateOnly(profile.premiumUntil);
  const premiumActive = profile.premiumUntil && new Date(profile.premiumUntil) > new Date();
  const anonUntil = dateOnly(profile.anonGenderUntil);
  const anonActive = profile.anonGenderUntil && new Date(profile.anonGenderUntil) > new Date();

  if (!isRegistered(profile)) {
    return (
      `👤 <b>(anketa to'ldirilmagan — faqat to'lov yozuvi)</b>\n` +
      `🆔 <code>${escapeHtml(id)}</code>\n` +
      (premiumUntil ? `💎 Premium: ${premiumActive ? "faol" : "tugagan"} (${premiumUntil})\n` : "") +
      (anonUntil ? `🕵️ Anonim jins filtri: ${anonActive ? "faol" : "tugagan"} (${anonUntil})\n` : "") +
      (invites ? `${invites}\n` : "") +
      contactLine(id, profile)
    );
  }

  return (
    `👤 <b>${escapeHtml(profile.name)}</b>, ${escapeHtml(profile.age)}\n` +
    `🆔 <code>${escapeHtml(id)}</code>\n` +
    `⚧ ${genderLine(profile)}\n` +
    `📍 ${escapeHtml(profile.location || "—")}\n` +
    `📞 ${escapeHtml(profile.phone || "—")}\n` +
    `📝 ${escapeHtml(profile.bio || "—")}\n\n` +
    `Holat: ${profile.active === false ? "🔴 Faolsiz" : "🟢 Faol"}\n` +
    `💎 Premium: ${premiumActive ? `faol (${premiumUntil} gacha)` : premiumUntil ? `tugagan (${premiumUntil})` : "yo'q"}\n` +
    `🕵️ Anonim jins filtri: ${anonActive ? `faol (${anonUntil} gacha)` : anonUntil ? `tugagan (${anonUntil})` : "yo'q"}\n` +
    (invites ? `${invites}\n` : "") +
    (likes ? `${likes}\n` : "") +
    (profile.updatedAt ? `🕒 Oxirgi yangilanish: ${escapeHtml(dateOnly(profile.updatedAt))}\n` : "") +
    `\n${contactLine(id, profile)}`
  );
}

// --- looking a payment up ----------------------------------------------------

// Order ids look like "anongender_0f775d70a0faeca9dbbd1af9" -- a type and 24
// hex characters. That is exactly what Click's own receipt shows the customer
// as "Buyurtma raqami", so pasting it here is the shortest path from "my
// payment is stuck" to knowing whose side it is stuck on.
const ORDER_ID_RE = /^(premium|unlock|vipchat|anongender)_[0-9a-f]{16,32}$/;

const ORDER_TYPE_LABEL = {
  premium: "💎 Premium",
  unlock: "🔐 Profil ochish",
  vipchat: "👑 VIP chat",
  anongender: "🕵️ Anonim jins filtri",
};

// What the ledger knows, and -- more useful -- what that MEANS about where
// the payment is stuck.
//
// A customer showing a Click receipt marked "Ko'rib chiqilmoqda" has no way
// to tell whether the money reached us, and neither did the operator. Three
// states, three completely different next steps:
//
//   pending   Click never completed a callback for it. Either it never
//             called (URLs missing in the cabinet) or it called and was
//             refused (CLICK_SECRET_KEY mismatch) -- the log says which.
//   prepared  Click's Prepare succeeded but Complete never arrived.
//   paid      The money is ours; the only remaining question is delivery.
function formatOrder(orderId, order) {
  if (!order) {
    return (
      `🔎 <code>${escapeHtml(orderId)}</code>\n\n` +
      `❌ Bunday buyurtma umuman topilmadi.\n\n` +
      `Ya'ni bu raqam bu bot yaratgan buyurtma emas — raqamni qayta tekshiring.`
    );
  }

  const label = ORDER_TYPE_LABEL[order.type] || order.type;
  const lines = [
    `🔎 <code>${escapeHtml(orderId)}</code>`,
    ``,
    `🛒 Nima: ${label}`,
    `👤 Kim: <code>${escapeHtml(String(order.userId))}</code>`,
    `💵 Summa: ${som(order.amount)}`,
    `💳 Qaysi tizim orqali ochilgan: ${order.provider || "click"}`,
    `🕒 Yaratilgan: ${order.createdAt ? escapeHtml(String(order.createdAt).slice(0, 19).replace("T", " ")) : "—"}`,
  ];

  if (order.status === "paid") {
    lines.push(
      ``,
      `✅ <b>To'langan.</b> Pul bizga yetib kelgan.`,
      `🕒 To'langan vaqti: ${order.paidAt ? escapeHtml(String(order.paidAt).slice(0, 19).replace("T", " ")) : "—"}`,
      order.delivered
        ? `📦 Xizmat berilgan: ha`
        : `⚠️ Xizmat hali berilmagan (${order.deliveryAttempts || 0} urinish). Bot uni o'zi qayta urinadi.`
    );
  } else if (order.status === "prepared") {
    lines.push(
      ``,
      `🟡 <b>Yarim yo'lda.</b> Click "Prepare" bosqichini yuborgan va biz qabul qilganmiz, ` +
        `lekin "Complete" bosqichi kelmagan.`,
      ``,
      `Bu Click tomonidagi holat — pul hali bizga o'tmagan.`
    );
  } else {
    lines.push(
      ``,
      `🔴 <b>To'lanmagan.</b> Bu buyurtma bo'yicha Clickdan birorta ham tasdiq kelmagan.`,
      ``,
      `Ikki sabab bo'lishi mumkin:`,
      `1️⃣ Click bizga umuman murojaat qilmagan — kabinetda Prepare/Complete URL lari yo'q yoki noto'g'ri`,
      `2️⃣ Murojaat qilgan, lekin biz rad etganmiz — CLICK_SECRET_KEY mos kelmayapti`,
      ``,
      `Qaysi biri ekani Render loglarida yozilgan: "Click prepare received" bo'lsa — ikkinchisi, ` +
        `umuman yo'q bo'lsa — birinchisi.`
    );
  }

  return lines.join("\n");
}

// --- two live orders, for Payme's onboarding ---------------------------------
//
// Before Payme switches a merchant on, their integration team asks for
// "ID и сумму по 2 заказам" -- two real order ids and what each one costs.
// They run their own test suite against our API with those ids, so the ids
// have to be ones our CheckPerformTransaction will actually accept: created
// by this bot, still PENDING (an already-paid order fails their check), and
// carrying the exact amount we will later compare their request against.
//
// Digging two ids out of the database by hand is how a wrong id gets sent and
// a week is lost to "your API rejects our test". One command instead.
//
// Two DIFFERENT products, deliberately: a single price proves nothing about
// whether the amount is compared at all, and Payme's suite checks that a
// wrong amount is refused.
const PAYME_SAMPLE_TYPES = ["premium", "anongender"];

// Payme counts in tiyin -- 1 so'm = 100 tiyin -- and this is the single most
// common thing to get wrong in an onboarding form. Both numbers are printed
// side by side so nobody has to multiply anything by hand.
function paymeSampleReport(entries) {
  const lines = [
    `🧾 <b>Payme uchun 2 ta buyurtma</b>`,
    ``,
    `Payme "ID и сумму по 2 заказам" so'raganda ana shularni yuboring.`,
    ``,
  ];

  entries.forEach((entry, i) => {
    lines.push(
      `<b>${i + 1}) ${ORDER_TYPE_LABEL[entry.type] || entry.type}</b>`,
      `🆔 <code>${escapeHtml(entry.orderId)}</code>`,
      `💵 ${som(entry.amount)} = <b>${entry.tiyin}</b> tiyin`,
      ``
    );
  });

  lines.push(
    `ℹ️ Payme summani <b>tiyin</b>da so'raydi: 1 so'm = 100 tiyin.`,
    `ℹ️ Hisob maydoni (account): <code>${escapeHtml(ACCOUNT_FIELD)}</code>`,
    ``,
    `⚠️ Bu buyurtmalar <b>to'lanmagan</b> holatda turadi — Payme aynan shunday buyurtmani tekshiradi. Ularni to'lamang.`
  );

  return lines.join("\n");
}

// The same facts again, in Russian and in a tap-to-copy block, because the
// next thing that happens is that this gets pasted into a chat with Payme.
function paymeSamplePaste(entries) {
  const rows = entries.map(
    (entry, i) =>
      `Заказ ${i + 1}: ${ACCOUNT_FIELD} = ${entry.orderId}, сумма = ${entry.amount} сум (${entry.tiyin} тийин)`
  );
  return `📋 Nusxa oling va Paymega yuboring:\n\n<pre>${escapeHtml(rows.join("\n"))}</pre>`;
}

// --- today's arrivals ---------------------------------------------------------

// "Today" in Tashkent, not UTC. The two disagree for five hours every night,
// which is exactly the window somebody checking the panel late would be
// asking about -- and being told "0 joined today" at 1am because the server
// has already rolled over is worse than not having the screen.
const TASHKENT_OFFSET_HOURS = 5;

function startOfTashkentDay(now = new Date()) {
  const shifted = new Date(now.getTime() + TASHKENT_OFFSET_HOURS * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TASHKENT_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
}

// How many are loaded per gender. This is a screen paged through by hand, so
// the cap is about what a person can actually look at, not what the database
// could return.
const TODAY_LIMIT = 200;

// Both buttons, always -- including when a count is zero.
//
// Hiding the empty one made the screen change shape from day to day: an
// admin who saw two buttons yesterday and one today has no way to tell "no
// girls joined" from "the girls button is broken", and reads it as the
// second. The count is on the button, so (0) says it plainly, and tapping it
// says it again in words.
function todayGenderKeyboard(boys, girls) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`👦 Bollar (${boys})`, "admin:today:male")],
    [Markup.button.callback(`👧 Qizlar (${girls})`, "admin:today:female")],
  ]);
}

// --- gifting everybody at once -----------------------------------------------
//
// The same four things the per-person gift buttons hand out, applied to the
// whole audience. Deliberately built on the SAME grant calls rather than
// bulk SQL: a gift given to a thousand people must be indistinguishable from
// one given to a single person, or the two paths drift and only one of them
// stays correct.
//
// extendFrom in particular is why: topping somebody up has to ADD to what
// they have left, and a bulk UPDATE setting everyone to "now + 30 days" would
// silently shorten every subscription that had more than a month on it.
const GIFT_ALL_KINDS = {
  credits: {
    label: "🔓 1 ta anketa ochish",
    describe: () => `🔓 <b>${GIFT_UNLOCK_CREDITS} ta bepul anketa ochish</b>`,
  },
  premium: {
    label: `💎 ${PREMIUM_DAYS} kunlik Premium`,
    describe: () => `💎 <b>${PREMIUM_DAYS} kunlik Premium</b>`,
  },
  vip: {
    label: "👑 VIP chatga kirish",
    describe: () => `👑 <b>VIP chatga kirish huquqi</b>`,
  },
  anon: {
    label: `🕵️ ${ANON_GENDER_DAYS} kunlik anonim filtr`,
    describe: () => `🕵️ <b>${ANON_GENDER_DAYS} kunlik anonim chat jins filtri</b>`,
  },
};

function giftAllKindKeyboard() {
  return Markup.inlineKeyboard(
    Object.entries(GIFT_ALL_KINDS).map(([kind, spec]) => [
      Markup.button.callback(spec.label, `admin:giftall:kind:${kind}`),
    ])
  );
}

function giftAllConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Ha, tarqatilsin", "admin:giftall:yes"),
      Markup.button.callback("❌ Yo'q, bekor", "admin:giftall:no"),
    ],
  ]);
}

// What each recipient sees: the admin's own words first, then exactly what
// they were given. The note alone would leave people guessing what arrived;
// the gift line alone would read as a system notice rather than a present.
function giftAllMessage(kind, note) {
  return (
    `🎁 <b>Sizga sovg'a!</b>\n\n` +
    `${note}\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `Nima berildi: ${GIFT_ALL_KINDS[kind].describe()}\n\n` +
    `Yoqimli foydalanish! 💛`
  );
}

// --- referral leaderboard ----------------------------------------------------

const REFERRAL_TOP_N = 10;
// Gold, silver, bronze, then plain numbers -- the top three are the ones an
// admin is usually looking for.
const RANK_MARKS = ["🥇", "🥈", "🥉"];
const rankMark = (i) => RANK_MARKS[i] || `${i + 1}.`;

// Who a referrer IS, from whatever we hold. Someone can bring in a crowd and
// still have no anketa of their own (they joined, invited, never finished the
// form), so this must never assume a profile exists -- an id alone is still a
// usable answer, and the admin can search it.
function referrerName(id, profile) {
  if (!profile || !isRegistered(profile)) return `<i>(anketasiz)</i>`;
  return `<b>${escapeHtml(profile.name)}</b>`;
}

// The leaderboard. One number per person: how many of their invitees actually
// FINISHED registering. A click on a link is not a user -- counting those
// would rank somebody who sent a link to a hundred people who all walked away
// above somebody who brought in ten who stayed.
function formatReferralBoard(rows) {
  if (rows.length === 0) {
    return (
      "🏆 Takliflar statistikasi\n\n" +
      "Hozircha hech kim taklif havolasi orqali ro'yxatdan o'tmagan.\n\n" +
      "Foydalanuvchilar «🎁 Do'stlarni taklif qilish» orqali havola olishadi — " +
      "birinchi odam anketani to'ldirishi bilan bu ro'yxat to'lib boradi."
    );
  }

  const lines = rows.map(
    (row, i) =>
      `${rankMark(i)} ${row.name} — <b>${row.rewarded}</b> ta\n` +
      `      🆔 <code>${escapeHtml(row.referrerId)}</code>`
  );

  const rewarded = rows.reduce((sum, r) => sum + r.rewarded, 0);

  return (
    `🏆 Takliflar statistikasi — TOP ${rows.length}\n\n` +
    `${lines.join("\n\n")}\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `📊 Shu ${rows.length} kishi jami <b>${rewarded}</b> ta ro'yxatdan o'tgan odam olib kelgan.\n\n` +
    `👆 Kimnidir yaqindan ko'rish uchun 🆔 sini nusxalab, «${USERS_LABEL}» orqali qidiring.`
  );
}

// A search used to fire off one full photo card per hit, so typing a common
// name like "Jahongir" buried the admin under a dozen photos before they
// could tell which one they wanted. Now a search answers with a compact list
// and the cards are opened one at a time, on request.
const SEARCH_PAGE_SIZE = 10;
// Everything past this is noise -- the admin should narrow the search instead.
const SEARCH_RESULT_LIMIT = 300;

// The open search list, per admin: which query, the hits, and which page is
// on screen. In memory because it lives for as long as one list is being
// browsed; if the process restarts mid-browse the buttons say so and the
// admin searches again.
const searchState = new Map();

// One entry per admin, each holding up to SEARCH_RESULT_LIMIT full profiles.
// Nothing removed them, so an admin who ran one wide search kept 300 profiles
// resident for the lifetime of the process, and every later search added
// another set for the next admin. Bounded by admin count, so never fatal --
// but it is a lot of memory held for a list nobody is looking at any more.
const SEARCH_STATE_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - SEARCH_STATE_TTL_MS;
  for (const [adminId, state] of searchState) {
    if ((state.openedAt || 0) < cutoff) searchState.delete(adminId);
  }
}, SEARCH_STATE_TTL_MS).unref();

// The anketa asks for an age, not a date of birth -- nothing on file can
// produce a day and month. The birth YEAR is the closest honest answer, and
// it is derived, so it is shown as such rather than as a stored fact.
function birthYearLabel(profile) {
  const age = Number(profile?.age);
  if (!Number.isFinite(age) || age <= 0) return "—";
  return `${new Date().getFullYear() - age}-yil (${age} yosh)`;
}

// "/u_<id>" is a real bot command, so Telegram turns it into a tappable link
// inside the list itself -- which is exactly "the id is the link". Tapping it
// sends the command back and the profile is posted underneath.
function searchResultLine(position, id, profile) {
  const href = profileLinkHref(id, profile);
  const label = profile?.username ? `@${escapeHtml(profile.username)}` : "profilga o'tish";
  const link = `<a href="${href}">${label}</a>`;
  const name = isRegistered(profile) ? escapeHtml(profile.name) : "(anketa to'ldirilmagan)";
  return (
    `${position}. /u_${escapeHtml(id)}\n` +
    `    👤 ${name}\n` +
    `    📞 ${escapeHtml(profile?.phone || "—")}\n` +
    `    🎂 ${birthYearLabel(profile)}\n` +
    `    🔗 ${link}`
  );
}

// Ten people per screen, moved through with back/forward. The buttons EDIT
// the list that is already on screen rather than posting another one, so
// browsing a long result set leaves a single message in the chat.
function searchPageKeyboard(page, pageCount) {
  if (pageCount <= 1) return Markup.inlineKeyboard([]);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("⬅️ Oldingi", `admin:pg:${page - 1}`),
      Markup.button.callback(`${page + 1}/${pageCount}`, "admin:pg:noop"),
      Markup.button.callback("Keyingisi ➡️", `admin:pg:${page + 1}`),
    ],
  ]);
}

function renderSearchPage(state) {
  const pageCount = Math.max(1, Math.ceil(state.hits.length / SEARCH_PAGE_SIZE));
  const page = Math.min(Math.max(state.page, 0), pageCount - 1);
  const start = page * SEARCH_PAGE_SIZE;
  const slice = state.hits.slice(start, start + SEARCH_PAGE_SIZE);

  // `title` lets another screen borrow this list wholesale -- same lines,
  // same paging buttons, same tappable /u_<id> -- and say what it is at the
  // top. Without it the day list would need its own renderer, which is how
  // two screens that should look identical stop looking identical.
  const header =
    (state.title || `🔍 «${escapeHtml(state.query)}» — ${state.hits.length} ta topildi`) +
    (pageCount > 1 ? `  (${page + 1}/${pageCount}-sahifa)` : "");
  const body = slice.map(([id, profile], i) => searchResultLine(start + i + 1, id, profile)).join("\n\n");

  return {
    page,
    pageCount,
    text: `${header}\n\n${body}\n\n👆 Id ustiga bosing — anketa pastda ochiladi.`,
    keyboard: searchPageKeyboard(page, pageCount),
  };
}

// Matches by Telegram id, name, @username or phone digits -- an admin
// searching for someone rarely knows which of those they have. Runs as one
// LIMITed SQL query on Postgres (see searchProfiles in pgStore.js) rather
// than loading every profile into memory and filtering here: that used to
// cost the same whether the table held a thousand rows or a million.
async function sendSearchResults(ctx, query) {
  const hits = await searchProfiles(query, SEARCH_RESULT_LIMIT);

  if (hits.length === 0) {
    await ctx.reply("Hech kim topilmadi.");
    return;
  }

  const state = { query, hits, page: 0, openedAt: Date.now() };
  searchState.set(ctx.from.id, state);
  const view = renderSearchPage(state);
  await ctx.reply(view.text, { parse_mode: "HTML", disable_web_page_preview: true, ...view.keyboard });
}

// Sends the search hit as the actual profile media with everything under it.
// If the media genuinely cannot be shown, the text card SAYS so and why --
// silently dropping it is what made "is it a photo or a video? nothing shows"
// impossible to diagnose.
async function sendUserCard(ctx, id, profile, mainBotTelegram) {
  const caption = await userCard(id, profile);
  const keyboard = await userActionsKeyboard(id, profile, ctx.from.id);

  if (profile.mediaFileId) {
    // Two jobs, and the second one is the important one.
    //
    // Visibly: the panel says "uploading photo..." the instant the id is
    // tapped, instead of looking like nothing happened.
    //
    // Structurally: sendChatAction is on Telegraf's webhook-reply allowlist,
    // so this call IS the HTTP response to Telegram's webhook request. That
    // closes the connection here rather than at the end of the handler (see
    // handleUpdate's finally). Without it Telegram waits for the whole
    // download-and-re-upload, decides delivery failed, and redelivers the
    // update on a backoff -- which is what turned a tap into minutes.
    await ctx
      .sendChatAction(profile.mediaType === "video" ? "upload_video" : "upload_photo")
      .catch(() => {});

    // Protected here too: an admin has no business forwarding somebody's
    // anketa photo out of the panel either.
    const failure = await replyWithProfileMedia(
      ctx,
      profile,
      { caption, parse_mode: "HTML", protect_content: true, ...keyboard },
      mainBotTelegram
    );
    if (!failure) return;
    console.error(`admin user media send failed for ${id}:`, failure);
    await ctx.reply(
      `${caption}\n\n⚠️ ${profile.mediaType === "video" ? "Video" : "Rasm"} ko'rsatib bo'lmadi.\n<code>${escapeHtml(failure)}</code>`,
      { parse_mode: "HTML", ...keyboard }
    );
    return;
  }

  await ctx.reply(`${caption}\n\n📷 Rasm/video yuklanmagan.`, { parse_mode: "HTML", ...keyboard });
}

// viewerId is who is LOOKING at this card, not who it belongs to -- it exists
// only to hide the demote button from an admin's own card. Deliberately not a
// real safeguard against locking the panel out (the handler below is): it
// just stops the far more likely accident of a tired admin tapping the wrong
// button on their own profile.
async function userActionsKeyboard(id, profile, viewerId) {
  const toggleLabel = profile.active === false ? "🟢 Faollantirish" : "🔴 Faolsizlantirish";
  const vip = await hasVipChat(id);
  const rows = [
    // Comping a paid feature, from the same screen the person is already on.
    // Useful well beyond the owner's own profile: settling a complaint,
    // thanking someone who brought a crowd in, or handing a prize out.
    [
      Markup.button.callback("💎 Premium +30 kun", `admin:gift:premium:${id}`),
      Markup.button.callback(vip ? "👑 VIP ✅" : "👑 VIP berish", `admin:gift:vip:${id}`),
    ],
    [
      Markup.button.callback("🕵️ Anonim filtr +7 kun", `admin:gift:anon:${id}`),
      // Built from the constant, never retyped: a hardcoded number here would
      // go on promising five long after the gift stopped being five.
      Markup.button.callback(`🎁 ${GIFT_UNLOCK_CREDITS} ta ochish`, `admin:gift:credits:${id}`),
    ],
    [Markup.button.callback(toggleLabel, `admin:toggle:${id}`), Markup.button.callback("🗑 O'chirish", `admin:delete:${id}`)],
  ];
  if (String(id) !== String(viewerId) && (await isAdmin(id))) {
    rows.push([Markup.button.callback("🚫 Admin huquqini bekor qilish", `admin:demote:${id}`)]);
  }
  return Markup.inlineKeyboard(rows);
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

// A user card is a photo/video with a caption when media exists and a plain
// text message otherwise, and Telegram needs a different edit call for each.
// Tries the caption edit first and falls back to the text edit, so toggling
// someone active/inactive updates the card either way.
async function safeUpdateCard(ctx, text, keyboard) {
  const extra = { parse_mode: "HTML", ...(keyboard ? { reply_markup: keyboard.reply_markup } : {}) };
  try {
    await ctx.editMessageCaption(text, extra);
    return;
  } catch {
    /* not a media message -- fall through to editing it as text */
  }
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    console.error("admin bot card update failed (ignored):", err.message);
  }
}

function pct(part, whole) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%";
}

function som(n) {
  return `${n.toLocaleString("uz-UZ")} so'm`;
}

// --- sales report --------------------------------------------------------

// One block per product, then a total. The total is computed here rather
// than added as a fifth field on getSalesSummary() -- it is nothing but the
// other four added up, and a report is the only place that ever needs it.
// The products, in the order they are reported. Written as data rather than
// as one long string so the total below is summed from the SAME list that is
// printed -- a hand-written total is how a newly added product ends up
// missing from the bottom line while appearing above it.
//
// Prices come from the constants, never retyped here: a hardcoded copy
// silently goes stale the moment a price changes. The ForResult board has no
// price to quote at all -- the buyer names the amount, which is the whole
// point of it.
function salesLines() {
  return [
    { key: "premium", label: "💎 Premium obuna" },
    { key: "unlock", label: `🔐 Sotilgan akkauntlar (profil ko'rish, ${som(UNLOCK_PRICE_SOM)}/dona)` },
    { key: "vipchat", label: `📢 VIP chat (yigitlar, ${som(VIP_CHAT_PRICE_SOM)}/dona)` },
    { key: "anongender", label: `🕵️ Anonim chat -- jins tanlash (haftalik, ${som(ANON_GENDER_PRICE_SOM)})` },
    { key: "adboard", label: "📊 ForResult afishalari (summani mijoz o'zi belgilaydi)" },
  ];
}

function formatSalesReport(sales, title) {
  const lines = salesLines();
  const totalCount = lines.reduce((sum, line) => sum + (sales[line.key]?.count || 0), 0);
  const totalRevenue = lines.reduce((sum, line) => sum + (sales[line.key]?.totalRevenue || 0), 0);

  const body = lines
    .map((line) => {
      const bucket = sales[line.key] || { count: 0, totalRevenue: 0 };
      return `${line.label}:\n✅ Sotilgan: ${bucket.count} ta\n💵 Jami tushum: ${som(bucket.totalRevenue)}`;
    })
    .join("\n\n");

  return (
    `💰 Sotuvlar hisoboti — ${title}\n\n` +
    `${body}\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `📊 Umumiy sotuv: ${totalCount} ta\n` +
    `💰 Umumiy tushum: ${som(totalRevenue)}`
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Rolling windows, not calendar week/month/year -- "haftalik" here means
// "the last 7 days from right now", the same convention the win-back
// sweeper and the AI assistant's own snapshot already use elsewhere in this
// file. A calendar week would reset to near-zero every Monday morning,
// which is a worse answer to "how are sales doing" than a rolling one.
const SALES_PERIODS = {
  week: { days: 7, title: "so'nggi 7 kun" },
  month: { days: 30, title: "so'nggi 30 kun" },
  year: { days: 365, title: "so'nggi 365 kun" },
};

function salesPeriodKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📅 Haftalik sotuv", "admin:sales:week"),
      Markup.button.callback("🗓 Oylik sotuv", "admin:sales:month"),
      Markup.button.callback("📆 Yillik sotuv", "admin:sales:year"),
    ],
  ]);
}

// Same real snapshot the AI assistant grounds its answers in (see
// aiAssistant.js), just formatted straight into text here -- no model call,
// no API cost, no dependency on ANTHROPIC_API_KEY at all. This is the button
// for "give me everything about the bot right now" without waiting on, or
// paying for, a language model.
function formatFullReport(snapshot) {
  const p = snapshot.profiles;
  const last30 = snapshot.newRegistrationsLast30Days;
  const prior30 = snapshot.newRegistrationsPrior30Days;
  const growthPercent =
    prior30.total > 0
      ? `${(((last30.total - prior30.total) / prior30.total) * 100).toFixed(1)}%`
      : last30.total > 0
        ? "yangi (avvalgi 30 kunda hech kim qo'shilmagan)"
        : "0.0%";
  const dailyAvg = (last30.total / 30).toFixed(1);

  const allRevenue =
    snapshot.salesAllTime.premium.totalRevenue +
    snapshot.salesAllTime.unlock.totalRevenue +
    snapshot.salesAllTime.vipchat.totalRevenue +
    snapshot.salesAllTime.anongender.totalRevenue;
  const last30Revenue =
    snapshot.salesLast30Days.premium.totalRevenue +
    snapshot.salesLast30Days.unlock.totalRevenue +
    snapshot.salesLast30Days.vipchat.totalRevenue +
    snapshot.salesLast30Days.anongender.totalRevenue;

  return (
    `📈 ForOne — To'liq hisobot\n` +
    `🕒 ${new Date(snapshot.generatedAt).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n\n` +
    `👥 Foydalanuvchilar\n` +
    `• Jami: ${p.total} ta\n` +
    `• Erkak: ${p.male} ta (${pct(p.male, p.total)})\n` +
    `• Ayol: ${p.female} ta (${pct(p.female, p.total)})\n` +
    `• Faol: ${p.active} ta (${pct(p.active, p.total)})\n` +
    `• Faolsiz: ${p.total - p.active} ta (${pct(p.total - p.active, p.total)})\n` +
    `• Premium (hozir faol): ${p.premiumNow} ta (${pct(p.premiumNow, p.total)})\n` +
    (p.pendingAnketa > 0 ? `• Anketasiz to'lov yozuvlari: ${p.pendingAnketa}\n` : "") +
    `\n📊 O'sish sur'ati (so'nggi 30 kun, avvalgisi bilan solishtirilgan)\n` +
    `• So'nggi 30 kunda qo'shilgan: ${last30.total} ta (erkak ${last30.male}, ayol ${last30.female})\n` +
    `• Undan oldingi 30 kunda: ${prior30.total} ta\n` +
    `• O'sish: ${growthPercent}\n` +
    `• Kunlik o'rtacha: ${dailyAvg} ta/kun\n\n` +
    `💰 Sotuvlar (jami vaqt davomida)\n` +
    `• Premium: ${snapshot.salesAllTime.premium.count} ta — ${som(snapshot.salesAllTime.premium.totalRevenue)}\n` +
    `• Profil ochish: ${snapshot.salesAllTime.unlock.count} ta — ${som(snapshot.salesAllTime.unlock.totalRevenue)}\n` +
    `• VIP chat: ${snapshot.salesAllTime.vipchat.count} ta — ${som(snapshot.salesAllTime.vipchat.totalRevenue)}\n` +
    `• Anonim (jins tanlash): ${snapshot.salesAllTime.anongender.count} ta — ${som(snapshot.salesAllTime.anongender.totalRevenue)}\n` +
    `• Jami tushum: ${som(allRevenue)}\n\n` +
    `💵 Sotuvlar (so'nggi 30 kun)\n` +
    `• Jami tushum: ${som(last30Revenue)} (jami tushumning ${pct(last30Revenue, allRevenue)})\n\n` +
    `🚨 Shikoyatlar\n` +
    `• Jami: ${snapshot.complaints.total} ta\n` +
    `• Javob berilgan: ${snapshot.complaints.answered} ta\n` +
    `• Javobsiz qolgan: ${snapshot.complaints.pending} ta`
  );
}

// mainBotTelegram is the MAIN bot's Telegram client, not this one's. A reply
// to a complaint has to reach the reporter in the bot they actually use --
// sending it from the admin bot would land in a chat they've never opened.
function createAdminBot(token, mainBotTelegram) {
  const bot = new Telegraf(token);

  // The main bot's flood guard exists because nothing else caps how fast a
  // scripted client can fire updates. That reasoning applies here too, and
  // more sharply: both bots run in this one process and share the same
  // 5-connection Postgres pool, so a flood of admin-bot updates -- even
  // unauthenticated ones, since /start alone does an isAdmin lookup -- can
  // starve the pool and degrade the MAIN bot's real users, not just this one.
  bot.use(floodGuardMiddleware);

  bot.start(async (ctx) => {
    // Being in the admins table is not enough on its own any more -- the
    // session also has to still be within its 12-hour window, or this is
    // exactly like never having logged in: back to the FAQ screen, same as
    // anyone who has never proven themselves at all.
    if (await isAdmin(ctx.from.id) && sessionValid(ctx.from.id)) {
      await ctx.reply("✅ Xush kelibsiz, admin!", adminMenuKeyboard());
      return;
    }
    await ctx.reply(FAQ_INTRO_TEXT, faqKeyboard());
  });

  // The only door into the PIN pad. Someone who does not already know this
  // command sees nothing but the FAQ screen above -- there is no button, no
  // hint, that this bot is an admin panel at all.
  bot.command("iamadmin", async (ctx) => {
    if (await isAdmin(ctx.from.id) && sessionValid(ctx.from.id)) {
      await ctx.reply("✅ Xush kelibsiz, admin!", adminMenuKeyboard());
      return;
    }
    loginState.set(ctx.from.id, "");
    await ctx.reply(`🔐 Kodni kiriting:\n${maskCode("")}`, pinKeyboard());
  });

  // Two real, unpaid order ids and their amounts, for Payme's onboarding.
  //
  // Not a button: this is used a handful of times in the life of the bot,
  // during one conversation with one payment provider, and a permanent button
  // for it would sit in the menu forever confusing everybody else.
  //
  // Repeating the command is safe and, importantly, gives the SAME two ids --
  // createOrder reuses a still-pending order for the same (person, product),
  // so an id already sent to Payme does not go stale the moment somebody taps
  // the command again.
  bot.command(
    "testorders",
    requireAdmin(async (ctx) => {
      const entries = [];
      for (const type of PAYME_SAMPLE_TYPES) {
        let orderId;
        try {
          orderId = await createOrder(ctx.from.id, { type, provider: "payme" });
        } catch (err) {
          console.error(`Could not create a Payme sample order (${type}):`, err.message);
          await ctx.reply(`⚠️ Buyurtma yaratib bo'lmadi (${type}): ${err.message}`);
          return;
        }
        // Read the amount back from the ledger rather than from the price
        // constant: a reused pending order is what Payme will be checking
        // against, and it carries its own stored amount.
        const order = await getOrder(orderId).catch(() => null);
        const amount = order?.amount ?? priceForType(type);
        entries.push({ type, orderId, amount, tiyin: somToTiyin(amount) });
      }

      await ctx.reply(paymeSampleReport(entries), { parse_mode: "HTML" });
      await ctx.reply(paymeSamplePaste(entries), { parse_mode: "HTML" });

      // Only when the merchant id is already set. Before that there is no
      // real checkout page to open, and a broken link would read as a bug in
      // the bot rather than as configuration that has not landed yet.
      const links = entries
        .map((entry) => ({ entry, url: buildCheckoutUrl(entry.orderId, entry.amount) }))
        .filter((row) => row.url);
      if (links.length) {
        await ctx.reply(
          `🔗 <b>Tekshirish uchun havolalar</b>\n\n` +
            links
              .map(
                ({ entry, url }) =>
                  `${ORDER_TYPE_LABEL[entry.type] || entry.type}:\n<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`
              )
              .join("\n\n"),
          { parse_mode: "HTML", disable_web_page_preview: true }
        );
      }
    })
  );

  bot.hears(FAQ_WHAT_LABEL, async (ctx) => {
    await ctx.reply(FAQ_WHAT_TEXT, faqKeyboard());
  });
  bot.hears(FAQ_FOUNDER_LABEL, async (ctx) => {
    await ctx.reply(FAQ_FOUNDER_TEXT, faqKeyboard());
  });
  bot.hears(FAQ_PRICING_LABEL, async (ctx) => {
    await ctx.reply(FAQ_PRICING_TEXT, faqKeyboard());
  });

  bot.action(/^admin:pin:(\d)$/, async (ctx) => {
    if (await isAdmin(ctx.from.id) && sessionValid(ctx.from.id)) {
      await safeAnswerCbQuery(ctx);
      return;
    }

    const remaining = lockoutRemainingMs(ctx.from.id);
    if (remaining > 0) {
      await safeAnswerCbQuery(ctx, `⏳ ${Math.ceil(remaining / 1000)}s kuting`);
      return;
    }
    if (globalRateLimited()) {
      await safeAnswerCbQuery(ctx, "⏳ Juda ko'p urinish, biroz kuting");
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
      // addAdmin is a harmless no-op for someone already in the table (their
      // very first login, versus a returning admin whose session just
      // expired, take the exact same path here) -- only the session is what
      // actually changes on a repeat login.
      await addAdmin(ctx.from.id);
      startSession(ctx.from.id);
      loginState.delete(ctx.from.id);
      failedAttempts.delete(ctx.from.id);
      await safeEditMessageText(ctx, "✅ Kod to'g'ri! Admin sifatida tasdiqlandingiz.");
      await ctx.reply("Admin panel:", adminMenuKeyboard());
    } else {
      loginState.set(ctx.from.id, "");
      const waitMs = recordFailedAttempt(ctx.from.id);
      await safeEditMessageText(
        ctx,
        `❌ Noto'g'ri kod. ${Math.ceil(waitMs / 1000)} soniyadan keyin qayta urinib ko'ring:\n${maskCode("")}`,
        pinKeyboard()
      );
    }
  });

  bot.action("admin:pin:back", async (ctx) => {
    if (await isAdmin(ctx.from.id) && sessionValid(ctx.from.id)) {
      await safeAnswerCbQuery(ctx);
      return;
    }
    const entered = (loginState.get(ctx.from.id) || "").slice(0, -1);
    loginState.set(ctx.from.id, entered);
    await safeAnswerCbQuery(ctx);
    await safeEditMessageText(ctx, `🔐 Kodni kiriting:\n${maskCode(entered)}`, pinKeyboard());
  });

  // Ends the CURRENT session only -- the admins-table entry is untouched, so
  // the same PIN logs this person straight back in. That is deliberately
  // different from "Admin huquqini bekor qilish" on someone else's card,
  // which is permanent and needs a different admin to undo.
  bot.hears(
    LOGOUT_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      endSession(ctx.from.id);
      loginState.set(ctx.from.id, "");
      await ctx.reply(
        `🚪 Admin sessiyasidan chiqdingiz.\n\n🔐 Qayta kirish uchun kodni kiriting:\n${maskCode("")}`,
        pinKeyboard()
      );
    })
  );

  bot.hears(
    STATS_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      // One aggregate query instead of loading every profile to count it here
      // -- that used to cost the same whether there were a thousand rows or a
      // million. Anketa counts only cover real registered profiles -- a
      // record holding nothing but a paid entitlement isn't a user with an
      // anketa. Premium is counted over everyone, since such a person IS a
      // paying customer either way.
      const { total, male, female, active, pendingAnketa, premiumNow } = await getProfileStats();

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
      leaveComposers(ctx.from.id);
      await ctx.reply(
        "🔍 Qidiruv\n\nIsm, Telegram ID, telefon raqam yoki @username yozing.\n" +
          "Ro'yxat chiqadi — kerakli id ustiga bossangiz, anketa pastda ochiladi.",
        adminMenuKeyboard()
      );
    })
  );

  // Premium, per-profile unlocks, and VIP chat access are all real Click
  // purchases now.
  bot.hears(
    SALES_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      const sales = await getSalesSummary();
      await ctx.reply(formatSalesReport(sales, "barcha vaqt"), salesPeriodKeyboard());
    })
  );

  // Same report, scoped to a rolling window. A separate message rather than
  // editing the one above -- the all-time totals stay on screen to compare
  // against, instead of being overwritten by whichever period was tapped last.
  bot.action(
    /^admin:sales:(week|month|year)$/,
    requireAdmin(async (ctx) => {
      await safeAnswerCbQuery(ctx);
      const period = SALES_PERIODS[ctx.match[1]];
      const sinceIso = new Date(Date.now() - period.days * DAY_MS).toISOString();
      const sales = await getSalesSummary(sinceIso);
      await ctx.reply(formatSalesReport(sales, period.title));
    })
  );

  // One button, the whole picture -- no AI call, no ANTHROPIC_API_KEY needed,
  // so this keeps working even when the AI assistant doesn't (e.g. no API
  // credit). Pulls the exact same real snapshot the AI grounds its own
  // answers in (see aiAssistant.js's buildDataSnapshot), just formatted here
  // directly instead of handed to a model first.
  bot.hears(
    REPORT_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      const snapshot = await buildDataSnapshot();
      await ctx.reply(formatFullReport(snapshot), adminMenuKeyboard());
    })
  );

  // Who is actually growing the bot. The referral reward pays out real money
  // (a free profile unlock costs 9 900 so'm), so this is both a thank-you
  // list and the place an abuse pattern would show up first -- one id sitting
  // far above everyone else with almost nothing rewarded.
  bot.hears(
    REFERRALS_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      // Aggregated in the store (one GROUP BY on Postgres), then at most ten
      // profile lookups for the names -- not a scan over every referral row
      // here, which would get slower exactly as the bot got more successful.
      const top = await topReferrers(REFERRAL_TOP_N);
      const rows = await Promise.all(
        top.map(async (row) => ({
          ...row,
          name: referrerName(row.referrerId, await getProfile(row.referrerId)),
        }))
      );
      await ctx.reply(formatReferralBoard(rows), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...adminMenuKeyboard(),
      });
    })
  );

  // Who joined today, and then who exactly.
  //
  // The summary answers "how did today go" in one tap; the two buttons under
  // it answer "who are they", one person at a time. Paged rather than dumped:
  // a good day is dozens of profiles, and a dozen photos fired into the chat
  // at once is the same mistake the likes list used to make.
  bot.hears(
    TODAY_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      const since = startOfTashkentDay();
      const [boys, girls] = await Promise.all([
        listNewProfilesSince("male", since, TODAY_LIMIT),
        listNewProfilesSince("female", since, TODAY_LIMIT),
      ]);
      const total = boys.length + girls.length;

      if (total === 0) {
        await ctx.reply(
          "📅 Bugun hali hech kim ro'yxatdan o'tmagan.\n\n" +
            "(Hisob Toshkent vaqti bilan yarim tundan boshlanadi.)",
          adminMenuKeyboard()
        );
        return;
      }

      await ctx.reply(
        `📅 <b>Bugun qo'shilganlar</b>\n\n` +
          `👥 Jami: <b>${total}</b> ta\n` +
          `👦 Bollar: ${boys.length} ta\n` +
          `👧 Qizlar: ${girls.length} ta\n\n` +
          `Kimlar ekanini ko'rish uchun pastdagi tugmani bosing 👇`,
        { parse_mode: "HTML", ...todayGenderKeyboard(boys.length, girls.length) }
      );
    })
  );

  // Opening one of the two lists.
  //
  // It hands the day's people to the SAME machinery a name search uses --
  // ten per screen, back/forward buttons that edit the message in place, and
  // every id rendered as a tappable /u_<id> that posts the full anketa
  // underneath. Not a second list implementation: the previous version was a
  // one-photo-at-a-time pager, which meant two screens doing the same job
  // and looking nothing alike.
  bot.action(
    /^admin:today:(male|female)$/,
    requireAdmin(async (ctx) => {
      const gender = ctx.match[1];
      await safeAnswerCbQuery(ctx);

      const people = await listNewProfilesSince(gender, startOfTashkentDay(), TODAY_LIMIT);
      if (people.length === 0) {
        await ctx.reply("Bu ro'yxat bo'sh — bugun bu jinsdan hech kim qo'shilmagan.");
        return;
      }

      // searchProfiles hands back [id, profile] pairs and the renderer reads
      // them that way, so the shapes are matched here rather than by teaching
      // the renderer a second one.
      const hits = people.map(({ id, profile }) => [id, profile]);
      const label = gender === "male" ? "👦 Bugun qo'shilgan bollar" : "👧 Bugun qo'shilgan qizlar";
      const state = {
        query: label,
        title: `${label} — ${hits.length} ta`,
        hits,
        page: 0,
        openedAt: Date.now(),
      };
      searchState.set(ctx.from.id, state);

      const view = renderSearchPage(state);
      await ctx.reply(view.text, { parse_mode: "HTML", disable_web_page_preview: true, ...view.keyboard });
    })
  );

  // --- gifting everybody at once ---
  //
  // Three steps, deliberately: pick the gift, write what to say about it, then
  // confirm. Handing something to every user at once is not undoable, so the
  // last screen shows exactly what is about to happen, to how many people,
  // before anything is granted.
  // --- ForResult moderation ---------------------------------------------
  //
  // Every ad on the board is a picture and a link chosen by a member of the
  // public and shown to every user of the bot. Payment is friction, not
  // vetting -- a scam or a link to something ugly is exactly as payable as a
  // coffee shop. So the operator gets a list of what is live and one tap to
  // take any of it down.
  //
  // Hiding never refunds or deletes: the row and the money paid stay on
  // record, so a wrongly hidden ad can be put straight back.
  // The board and its moderation screen live in the MAIN bot; only these two
  // commands are kept here, because the "new ad" alert is delivered through
  // this bot (see configureAlerts in index.js) and its one-tap /adhide_12
  // has to work in the chat it actually lands in. Deciding on an ad the
  // moment you are told about it is the whole point of that alert.
  bot.hears(/^\/adhide_(\d+)$/, requireAdmin(async (ctx) => {
    const id = ctx.match[1];
    const ad = await setAdActive(id, false);
    await ctx.reply(ad ? `🚫 Afisha #${id} yashirildi.` : `Afisha #${id} topilmadi.`);
    if (ad) console.log(`ForResult ad ${id} hidden by admin ${ctx.from.id}`);
  }));

  bot.hears(/^\/adshow_(\d+)$/, requireAdmin(async (ctx) => {
    const id = ctx.match[1];
    const ad = await setAdActive(id, true);
    await ctx.reply(ad ? `✅ Afisha #${id} qaytarildi.` : `Afisha #${id} topilmadi.`);
    if (ad) console.log(`ForResult ad ${id} shown by admin ${ctx.from.id}`);
  }));

  bot.hears(
    GIFT_ALL_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      giftAllDraft.set(ctx.from.id, { step: "kind" });
      await ctx.reply(
        "🎁 <b>Hammaga ehson</b>\n\n" +
          "1️⃣ Avval qaysi sovg'ani tarqatmoqchisiz? Pastdan tanlang 👇",
        { parse_mode: "HTML", ...giftAllKindKeyboard() }
      );
    })
  );

  bot.action(
    /^admin:giftall:kind:(credits|premium|vip|anon)$/,
    requireAdmin(async (ctx) => {
      const kind = ctx.match[1];
      await safeAnswerCbQuery(ctx);
      const draft = giftAllDraft.get(ctx.from.id);
      // The buttons live on a message that stays in the chat, so an old one
      // can be tapped long after the flow was abandoned. Without this, that
      // tap would start a half-initialised gift from the middle.
      if (draft?.step !== "kind") {
        await ctx.reply(`Bu tugma eskirgan — «${GIFT_ALL_LABEL}» dan qaytadan boshlang.`, adminMenuKeyboard());
        return;
      }

      draft.kind = kind;
      draft.step = "note";
      await ctx.reply(
        `Tanlandi: ${GIFT_ALL_KINDS[kind].describe()}\n\n` +
          "2️⃣ Endi nima deb izoh yozasiz? Foydalanuvchilar sovg'a bilan birga shu matnni ko'radi.\n\n" +
          "Masalan: «Bugun botimizga 1000 kishi qo'shildi — shu munosabat bilan hammaga sovg'a! 🎉»",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    })
  );

  bot.action(
    "admin:giftall:no",
    requireAdmin(async (ctx) => {
      await safeAnswerCbQuery(ctx);
      giftAllDraft.delete(ctx.from.id);
      await ctx.reply("❌ Bekor qilindi. Hech kimga hech narsa berilmadi.", adminMenuKeyboard());
    })
  );

  bot.action(
    "admin:giftall:yes",
    requireAdmin(async (ctx) => {
      await safeAnswerCbQuery(ctx);
      const draft = giftAllDraft.get(ctx.from.id);
      if (draft?.step !== "confirm") {
        await ctx.reply(`Bu tugma eskirgan — «${GIFT_ALL_LABEL}» dan qaytadan boshlang.`, adminMenuKeyboard());
        return;
      }
      // Cleared before the run starts, so a second tap on the same message
      // cannot set the whole thing going twice.
      giftAllDraft.delete(ctx.from.id);

      const recipients = await listAllProfileIds();
      if (recipients.length === 0) {
        await ctx.reply("Sovg'a beradigan foydalanuvchi yo'q.", adminMenuKeyboard());
        return;
      }

      await ctx.reply(
        `🚀 Tarqatish boshlandi — ${recipients.length} ta foydalanuvchi.\n` +
          `Tugagach xabar beraman, kutib turishingiz shart emas.`,
        adminMenuKeyboard()
      );
      // Not awaited: this takes minutes for a large audience and must not
      // block the admin's chat or anything else the bot is handling.
      runGiftAll(mainBotTelegram, ctx.chat.id, ctx.telegram, draft, recipients).catch((err) =>
        console.error("gift-all crashed:", err)
      );
    })
  );

  // --- AI assistant ---
  //
  // An open-ended chat, not a one-shot report: every message this admin
  // sends from here on (see the catch-all "text" handler below) is either
  // a question or a follow-up, answered with the running history attached,
  // until they tap Orqaga -- never by parsing this button press itself.
  bot.hears(
    AI_LABEL,
    requireAdmin(async (ctx) => {
      leaveComposers(ctx.from.id);
      if (!aiConfigured()) {
        await ctx.reply(
          "🤖 AI yordamchi hozircha sozlanmagan (ANTHROPIC_API_KEY yo'q). Server administratoriga xabar bering.",
          adminMenuKeyboard()
        );
        return;
      }
      aiAwaiting.add(ctx.from.id);
      await ctx.reply(
        "🤖 AI yordamchi bilan suhbat boshlandi.\n\n" +
          "Xohlagan savolingizni yozing — bot statistikasi, maslahat, yoki umuman boshqa mavzu bo'lishi mumkin. " +
          "Masalan:\n" +
          "• Oxirgi oy to'liq hisobot\n" +
          "• Bugun nechta yangi foydalanuvchi qo'shildi\n" +
          "• Sotuvlar qanday ketyapti\n\n" +
          "Suhbatni davom ettiraverishingiz mumkin, tugatish uchun \"Orqaga\" tugmasini bosing.",
        cancelKeyboard()
      );
    })
  );

  // --- Broadcast flow ---
  bot.hears(
    BROADCAST_LABEL,
    requireAdmin(async (ctx) => {
      complaintCursor.delete(ctx.from.id);
      // A fresh draft each time, so an abandoned half-composed advert can
      // never be resumed by accident.
      broadcastDraft.set(ctx.from.id, { step: "media" });
      await ctx.reply(
        "📢 Nima reklama bermoqchisiz?\n\n" +
          "1️⃣ Avval rasm yoki video yuboring.\n" +
          `Rasmsiz, faqat matn yubormoqchi bo'lsangiz — "${SKIP_MEDIA_LABEL}".`,
        Markup.keyboard([[SKIP_MEDIA_LABEL], [BACK_LABEL]]).resize()
      );
    })
  );

  // Shows what the advert will actually look like, then asks to confirm --
  // the preview is sent exactly the way recipients will receive it, so there
  // are no surprises after the point of no return.
  async function showBroadcastPreview(ctx, draft) {
    draft.step = "confirm";
    await ctx.reply("👀 Namuna — foydalanuvchilar aynan shuni ko'radi:");
    try {
      if (draft.fileId && draft.mediaType === "video") {
        await ctx.replyWithVideo(draft.fileId, { caption: draft.text, parse_mode: "HTML" });
      } else if (draft.fileId) {
        await ctx.replyWithPhoto(draft.fileId, { caption: draft.text, parse_mode: "HTML" });
      } else {
        await ctx.reply(draft.text, { parse_mode: "HTML" });
      }
    } catch (err) {
      // Almost always a stray < or & in the admin's own text, which HTML mode
      // reads as a broken tag. Better to say so now than to fail once per
      // recipient mid-broadcast.
      //
      // The draft is KEPT, and the step goes back to "text". Deleting it
      // threw away the photo they had already uploaded and sent them back to
      // the start of the whole flow -- for a typo they could have fixed by
      // resending one message.
      draft.step = "text";
      await ctx.reply(
        `⚠️ Matnni ko'rsatib bo'lmadi:\n${err.message}\n\n` +
          "Ko'pincha sabab: matnda < yoki & belgisi bor va bot uni HTML teg deb o'qiydi.\n\n" +
          "Tuzatilgan matnni shu yerga qayta yuboring — rasm saqlanib qoldi.",
        cancelKeyboard()
      );
      return;
    }
    const total = (await listAllProfileIds()).length;
    await ctx.reply(
      `Tasdiqlaysizmi?\n\n👥 Taxminan ${total} ta foydalanuvchiga yuboriladi.`,
      confirmKeyboard()
    );
  }

  // Telegram's own limits, and the reason a long advert used to go nowhere.
  //
  // A message carrying a photo or video is a CAPTION, and a caption is capped
  // at 1024 characters -- a quarter of what a plain text message allows. Past
  // that the send fails, so an advert that was fine yesterday breaks the
  // moment a picture is added to it.
  //
  // Checked here, against the exact number, rather than left to come back as
  // a 400 from Telegram: "you are 240 characters over" is something an admin
  // can act on, and "Bad Request: MEDIA_CAPTION_TOO_LONG" is not.
  const TEXT_LIMIT = 4096;
  const CAPTION_LIMIT = 1024;

  function broadcastLengthProblem(draft, text) {
    const limit = draft.fileId ? CAPTION_LIMIT : TEXT_LIMIT;
    if (text.length <= limit) return null;
    const over = text.length - limit;
    return (
      `⚠️ Matn juda uzun.\n\n` +
      `📏 Sizniki: <b>${text.length}</b> belgi\n` +
      `📐 Ruxsat etilgani: <b>${limit}</b> belgi\n` +
      `✂️ Qisqartirish kerak: <b>${over}</b> belgi\n\n` +
      (draft.fileId
        ? "Sabab: rasm/video bilan yuborilgan matnga Telegram atigi 1024 belgi ruxsat beradi " +
          "(rasmsiz matnga esa 4096).\n\nIkki yo'l bor:\n" +
          "1️⃣ Matnni qisqartiring\n" +
          `2️⃣ Yoki «${BACK_LABEL}» → «${BROADCAST_LABEL}» → «${SKIP_MEDIA_LABEL}» — rasmsiz yuborsangiz 4096 belgi sig'adi\n\n`
        : "Telegram bitta xabarga 4096 belgidan ko'p sig'dira olmaydi.\n\n") +
      "Qisqartirilgan matnni shu yerga qayta yuboring."
    );
  }

  bot.hears(
    SKIP_MEDIA_LABEL,
    requireAdmin(async (ctx) => {
      const draft = broadcastDraft.get(ctx.from.id);
      if (draft?.step !== "media") return;
      draft.step = "text";
      await ctx.reply("2️⃣ Endi nima yozmoqchisiz? Reklama matnini yuboring:", cancelKeyboard());
    })
  );

  // Photo/video arriving while composing an advert.
  bot.on(
    ["photo", "video"],
    requireAdmin(async (ctx) => {
      const draft = broadcastDraft.get(ctx.from.id);
      if (draft?.step !== "media") return;
      if (ctx.message.photo) {
        draft.fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        draft.mediaType = "photo";
      } else {
        draft.fileId = ctx.message.video.file_id;
        draft.mediaType = "video";
      }
      draft.step = "text";
      await ctx.reply("✅ Qabul qilindi.\n\n2️⃣ Endi nima yozmoqchisiz? Reklama matnini yuboring:", cancelKeyboard());
    })
  );

  bot.hears(
    CONFIRM_NO_LABEL,
    requireAdmin(async (ctx) => {
      if (!broadcastDraft.has(ctx.from.id)) return;
      broadcastDraft.delete(ctx.from.id);
      await ctx.reply("❌ Reklama bekor qilindi, hech kimga yuborilmadi.", adminMenuKeyboard());
    })
  );

  bot.hears(
    CONFIRM_YES_LABEL,
    requireAdmin(async (ctx) => {
      const draft = broadcastDraft.get(ctx.from.id);
      if (draft?.step !== "confirm") return;
      broadcastDraft.delete(ctx.from.id);

      const recipients = await listAllProfileIds();
      if (recipients.length === 0) {
        await ctx.reply("Yuboradigan foydalanuvchi yo'q.", adminMenuKeyboard());
        return;
      }

      await ctx.reply(
        `🚀 Yuborish boshlandi — ${recipients.length} ta foydalanuvchi.\n` +
          `Tugagach xabar beraman, kutib turishingiz shart emas.`,
        adminMenuKeyboard()
      );
      // Not awaited: this takes minutes for a large audience and must not
      // block the admin's chat or anything else the bot is handling.
      runBroadcast(mainBotTelegram, ctx.chat.id, ctx.telegram, draft, recipients).catch((err) =>
        console.error("broadcast crashed:", err)
      );
    })
  );

  // Opens the list and puts the admin at the top of it.
  bot.hears(
    COMPLAINTS_LABEL,
    requireAdmin(async (ctx) => {
      broadcastDraft.delete(ctx.from.id);
      aiAwaiting.delete(ctx.from.id);
      aiHistory.delete(ctx.from.id);
      const complaints = await listComplaints();
      if (complaints.length === 0) {
        complaintCursor.delete(ctx.from.id);
        await ctx.reply("🚨 Hozircha shikoyatlar yo'q.", adminMenuKeyboard());
        return;
      }
      // index: -1 means "list shown, nothing opened yet" -- the first
      // Keyingisi lands on complaint 0. Opening one here would defeat the
      // point of the list, which is to choose rather than be shown.
      complaintCursor.set(ctx.from.id, { ids: complaints.map((c) => c.id), index: -1, viewing: null });
      await ctx.reply(complaintListText(complaints), { parse_mode: "HTML", ...complaintNavKeyboard() });
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

  // The single way out of any sub-screen. It clears BOTH the complaint cursor
  // and any half-composed advert: this hears() runs before the text handler,
  // so leaving a draft behind here would mean the next thing typed silently
  // became advert copy.
  bot.hears(
    BACK_LABEL,
    requireAdmin(async (ctx) => {
      const hadDraft = broadcastDraft.delete(ctx.from.id);
      const hadAiChat = aiAwaiting.delete(ctx.from.id);
      complaintCursor.delete(ctx.from.id);
      aiHistory.delete(ctx.from.id);
      await ctx.reply(
        hadDraft ? "❌ Reklama bekor qilindi." : hadAiChat ? "🤖 AI suhbat tugatildi." : "Admin panel:",
        adminMenuKeyboard()
      );
    })
  );

  // Tapping an id in a search list sends this back. Registered before the
  // catch-all text handler below so it is never mistaken for a search term or
  // for the answer to an open complaint.
  bot.hears(
    /^\/u_(\d+)(?:@\w+)?$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];
      const profile = await getProfile(targetId);
      if (!profile) {
        await ctx.reply(`🆔 ${targetId} — bunday foydalanuvchi topilmadi.`);
        return;
      }
      await sendUserCard(ctx, targetId, profile, mainBotTelegram);
    })
  );

  // Search lists sent before paging existed still carry numbered buttons.
  // Kept so those older messages don't turn into dead taps.
  bot.action(
    /^admin:show:(.+)$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];
      const profile = await getProfile(targetId);
      await safeAnswerCbQuery(ctx);
      if (!profile) {
        await ctx.reply(`🆔 ${targetId} — bunday foydalanuvchi topilmadi.`);
        return;
      }
      await sendUserCard(ctx, targetId, profile, mainBotTelegram);
    })
  );

  // Back/forward through a search list. Edits the message already on screen
  // instead of posting a new one.
  bot.action(
    /^admin:pg:(noop|\d+)$/,
    requireAdmin(async (ctx) => {
      if (ctx.match[1] === "noop") {
        await safeAnswerCbQuery(ctx);
        return;
      }
      const state = searchState.get(ctx.from.id);
      if (!state) {
        await safeAnswerCbQuery(ctx, "Ro'yxat eskirgan — qaytadan qidiring.");
        return;
      }

      const requested = Number(ctx.match[1]);
      const pageCount = Math.max(1, Math.ceil(state.hits.length / SEARCH_PAGE_SIZE));
      if (requested < 0) {
        await safeAnswerCbQuery(ctx, "Bu birinchi sahifa.");
        return;
      }
      if (requested > pageCount - 1) {
        await safeAnswerCbQuery(ctx, "Bu oxirgi sahifa.");
        return;
      }

      state.page = requested;
      const view = renderSearchPage(state);
      await safeAnswerCbQuery(ctx);
      await safeEditMessageText(ctx, view.text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...view.keyboard,
      });
    })
  );

  // Registered after the hears() calls above, so it only catches text that
  // didn't match a menu button -- i.e. a complaint id, a reply, or a search.
  bot.on(
    "text",
    requireAdmin(async (ctx) => {
      const query = ctx.message.text.trim();
      if (!query) return;

      // An open AI chat takes priority over everything else below -- while
      // this admin is inside it, every message is a question or a follow-up,
      // not a search term or a complaint reply. Stays open (aiAwaiting is
      // NOT cleared here) so the conversation continues without having to
      // tap the button again; only the dedicated BACK_LABEL handler above
      // leaves it.
      if (aiAwaiting.has(ctx.from.id)) {
        await ctx.sendChatAction("typing");
        try {
          const history = aiHistory.get(ctx.from.id) || [];
          const { answer, history: updatedHistory } = await askAdminAssistant(query, history);
          aiHistory.set(ctx.from.id, updatedHistory);
          await ctx.reply(answer, cancelKeyboard());
        } catch (err) {
          // The admin is the only audience for this message, so the real
          // error (bad API key, rate limit, a model/network hiccup) is worth
          // showing directly instead of a generic "try again" that hides
          // what actually needs fixing.
          console.error("AI assistant failed:", err);
          await ctx.reply(`⚠️ AI yordamchidan javob olib bo'lmadi:\n${err.message}`, cancelKeyboard());
        }
        return;
      }

      // Writing the note that goes with a mass gift. Same priority reasoning
      // as the advert below: while a gift is waiting for its wording, that is
      // what this message is.
      const gift = giftAllDraft.get(ctx.from.id);
      if (gift) {
        if (query === BACK_LABEL) {
          giftAllDraft.delete(ctx.from.id);
          await ctx.reply("❌ Ehson bekor qilindi.", adminMenuKeyboard());
          return;
        }
        if (gift.step === "kind") {
          await ctx.reply("Avval sovg'ani tanlang 👆", cancelKeyboard());
          return;
        }
        if (gift.step === "note") {
          // The note is rendered inside an HTML message, so an unescaped < or
          // & the admin typed would be read as a broken tag and Telegram would
          // refuse every single delivery.
          gift.note = escapeHtml(ctx.message.text);
          gift.step = "confirm";

          const recipients = await listAllProfileIds();
          await ctx.reply(
            `👀 <b>Namuna — foydalanuvchilar aynan shuni ko'radi:</b>\n\n` +
              `${giftAllMessage(gift.kind, gift.note)}`,
            { parse_mode: "HTML" }
          );
          await ctx.reply(
            `3️⃣ Tasdiqlaysizmi?\n\n` +
              `🎁 Sovg'a: ${GIFT_ALL_KINDS[gift.kind].describe()}\n` +
              `👥 Kimga: <b>${recipients.length}</b> ta foydalanuvchiga\n\n` +
              `⚠️ Bu amalni orqaga qaytarib bo'lmaydi.`,
            { parse_mode: "HTML", ...giftAllConfirmKeyboard() }
          );
          return;
        }
        if (gift.step === "confirm") {
          await ctx.reply("Pastdagi «✅ Ha» yoki «❌ Yo'q» tugmasini bosing.", cancelKeyboard());
          return;
        }
      }

      // Composing an advert takes priority: while a draft is waiting for its
      // text, that is what this message is -- not a search and not a reply.
      const draft = broadcastDraft.get(ctx.from.id);
      if (draft) {
        if (query === BACK_LABEL) {
          broadcastDraft.delete(ctx.from.id);
          await ctx.reply("❌ Reklama bekor qilindi.", adminMenuKeyboard());
          return;
        }
        if (draft.step === "media") {
          await ctx.reply(
            `Avval rasm yoki video yuboring, yoki "${SKIP_MEDIA_LABEL}" tugmasini bosing.`,
            Markup.keyboard([[SKIP_MEDIA_LABEL], [BACK_LABEL]]).resize()
          );
          return;
        }
        if (draft.step === "text") {
          // Checked before anything is stored, so the draft still holds the
          // last text that actually worked rather than one that cannot be
          // sent.
          const tooLong = broadcastLengthProblem(draft, ctx.message.text);
          if (tooLong) {
            await ctx.reply(tooLong, { parse_mode: "HTML", ...cancelKeyboard() });
            return;
          }
          draft.text = ctx.message.text;
          await showBroadcastPreview(ctx, draft);
          return;
        }
        if (draft.step === "confirm") {
          await ctx.reply(
            `Iltimos, "${CONFIRM_YES_LABEL}" yoki "${CONFIRM_NO_LABEL}" tugmasini bosing.`,
            confirmKeyboard()
          );
          return;
        }
      }

      // A payment id pasted straight off a Click receipt. Checked before the
      // complaint code and the search, because it cannot be mistaken for
      // either -- and because "where is my money" is the question somebody is
      // usually standing in front of you asking.
      if (ORDER_ID_RE.test(query)) {
        let order = null;
        try {
          order = await getOrder(query);
        } catch (err) {
          console.error(`Could not read order ${query}:`, err.message);
          await ctx.reply(`⚠️ Buyurtmani o'qib bo'lmadi: ${err.message}`);
          return;
        }
        await ctx.reply(formatOrder(query, order), { parse_mode: "HTML" });
        return;
      }

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
        // Cleared the moment the reply is recorded, win or lose on delivery
        // below -- otherwise "javobingizni yozing" stayed open forever, and
        // literally everything the admin typed next (a search, a second
        // complaint code, anything) was silently swallowed as ANOTHER reply
        // to this same already-answered complaint instead of doing what it
        // actually said. ids/index are left alone so Keyingisi/Orqaga still
        // pick up from here.
        cursor.viewing = null;
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

      await sendSearchResults(ctx, query);
    })
  );

  // Comping a paid feature to somebody -- including yourself. Everything it
  // grants goes through the SAME storage calls a real Click payment uses, so
  // a gifted entitlement is indistinguishable from a bought one everywhere
  // downstream. Deliberately NOT written into the sales ledger: it was never
  // money, and counting it as revenue would quietly corrupt every figure on
  // the Sotuvlar and To'liq hisobot screens.
  bot.action(
    /^admin:gift:(premium|vip|anon|credits):(.+)$/,
    requireAdmin(async (ctx) => {
      const kind = ctx.match[1];
      const targetId = ctx.match[2];

      const profile = await getProfile(targetId);
      if (!profile) {
        await safeAnswerCbQuery(ctx, "Topilmadi");
        return;
      }

      let toast;
      let notice;
      if (kind === "premium") {
        // extendFrom, not "days from today" -- gifting to somebody who still
        // has time left must add to it, never overwrite it.
        await setPremiumUntil(targetId, extendFrom(profile.premiumUntil, PREMIUM_DAYS));
        toast = `💎 Premium +${PREMIUM_DAYS} kun`;
        notice = `🎁 Sizga sovg'a: 💎 Premium ${PREMIUM_DAYS} kunga faollashtirildi!`;
      } else if (kind === "vip") {
        if (await hasVipChat(targetId)) {
          await safeAnswerCbQuery(ctx, "👑 VIP allaqachon bor");
          return;
        }
        await grantVipChat(targetId);
        toast = "👑 VIP berildi";
        notice = `🎁 Sizga sovg'a: 👑 VIP suhbatga kirish huquqi ochildi!\n\n${VIP_CHAT_INVITE_LINK}`;
      } else if (kind === "anon") {
        await setAnonGenderFilterUntil(targetId, extendFrom(profile.anonGenderUntil, ANON_GENDER_DAYS));
        toast = `🕵️ Anonim filtr +${ANON_GENDER_DAYS} kun`;
        notice = `🎁 Sizga sovg'a: 🕵️ Anonim chatda jins tanlash ${ANON_GENDER_DAYS} kunga ochildi!`;
      } else {
        await addUnlockCredits(targetId, GIFT_UNLOCK_CREDITS);
        toast = `🎁 ${GIFT_UNLOCK_CREDITS} ta ochish berildi`;
        notice = `🎁 Sizga sovg'a: ${GIFT_UNLOCK_CREDITS} ta bepul anketa ochish imkoniyati berildi!`;
      }

      await safeAnswerCbQuery(ctx, toast);

      // Telling them is the point of a gift. Best-effort: somebody who has
      // blocked the bot must not turn granting into a failure -- the
      // entitlement is already written either way.
      try {
        await mainBotTelegram.sendMessage(targetId, notice);
      } catch (err) {
        console.error(`gift notice to ${targetId} failed (ignored):`, err.message);
      }

      const updated = await getProfile(targetId);
      await safeUpdateCard(ctx, await userCard(targetId, updated), await userActionsKeyboard(targetId, updated, ctx.from.id));
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
      await safeUpdateCard(ctx, await userCard(targetId, updated), await userActionsKeyboard(targetId, updated, ctx.from.id));

      // Someone whose anketa was hidden could otherwise keep swiping for days
      // without ever learning that nobody can see them any more.
      const notice = newActive ? notifyAccountReactivated : notifyAccountDeactivated;
      const delivered = await notice(mainBotTelegram, targetId).then(
        () => true,
        (err) => {
          console.error(`could not tell ${targetId} their anketa was toggled:`, err.message);
          return false;
        }
      );
      if (!delivered) {
        await ctx.reply(`⚠️ ${targetId} ga xabar yetkazilmadi (botni bloklagan bo'lishi mumkin).`);
      }
    })
  );

  bot.action(
    /^admin:delete:(.+)$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];

      // Told BEFORE the delete: getLanguage survives it, but reading their
      // language while the row still exists keeps the two independent.
      const delivered = await notifyAccountDeleted(mainBotTelegram, targetId).then(
        () => true,
        (err) => {
          console.error(`could not tell ${targetId} their account was deleted:`, err.message);
          return false;
        }
      );

      await deleteProfile(targetId);
      await safeAnswerCbQuery(ctx, "O'chirildi");
      await safeUpdateCard(
        ctx,
        delivered
          ? "🗑 Anketa o'chirildi.\n✅ Foydalanuvchiga xabar berildi."
          : "🗑 Anketa o'chirildi.\n⚠️ Foydalanuvchiga xabar yetkazilmadi (botni bloklagan bo'lishi mumkin)."
      );
    })
  );

  // The PIN has no expiry and grants access permanently -- this is the only
  // way to take it back without shell access to the host. Guarded against
  // the one way it could backfire: refusing to strip the LAST admin, which
  // would lock everyone out of the panel with no PIN-holder left to fix it.
  bot.action(
    /^admin:demote:(.+)$/,
    requireAdmin(async (ctx) => {
      const targetId = ctx.match[1];

      if (String(targetId) === String(ctx.from.id)) {
        await safeAnswerCbQuery(ctx, "O'zingizni olib tashlay olmaysiz");
        return;
      }
      if (!(await isAdmin(targetId))) {
        await safeAnswerCbQuery(ctx, "Bu odam admin emas");
        return;
      }
      const admins = await listAdmins();
      if (admins.length <= 1) {
        await safeAnswerCbQuery(ctx, "Oxirgi adminni olib tashlab bo'lmaydi");
        return;
      }

      await removeAdmin(targetId);
      endSession(targetId);
      await safeAnswerCbQuery(ctx, "Admin huquqi bekor qilindi");
      const profile = await getProfile(targetId);
      if (profile) {
        await safeUpdateCard(ctx, await userCard(targetId, profile), await userActionsKeyboard(targetId, profile, ctx.from.id));
      }
      try {
        await mainBotTelegram.sendMessage(targetId, "ℹ️ Sizning admin panelga kirish huquqingiz bekor qilindi.");
      } catch (err) {
        console.error(`could not notify ${targetId} of admin demotion:`, err.message);
      }
    })
  );

  // An error escaping a handler used to be logged and alerted, and NOTHING
  // was said to the admin standing in front of the panel. From their side the
  // bot simply stopped answering -- the same screen, the same keyboard, no
  // reply, no explanation. "It froze" is exactly what that looks like, and it
  // is indistinguishable from the bot being down.
  //
  // So the admin is told too, and handed the main menu back so there is a way
  // out that is not "close the chat and hope".
  bot.catch(async (err, ctx) => {
    console.error(`Admin bot error for update ${ctx.updateType}:`, err);
    alert(`Admin bot error on ${ctx.updateType}:\n${err.stack || err.message}`).catch(() => {});

    // Whatever half-finished thing was on screen is what just failed; leaving
    // it set would feed the next message into the same broken step.
    leaveComposers(ctx.from?.id);

    try {
      await ctx.reply(
        `⚠️ Xatolik yuz berdi va amal bajarilmadi:\n${err.message}\n\n` +
          "Asosiy menyuga qaytdingiz — qaytadan urinib ko'ring.",
        adminMenuKeyboard()
      );
    } catch (replyErr) {
      // The reply itself failing is the one case where silence is genuinely
      // all that is left. Log it rather than throwing from the error handler.
      console.error("Admin bot could not report its own error:", replyErr.message);
    }
  });

  return bot;
}

module.exports = {
  createAdminBot,
  // Exposed so the sweep can be driven directly: waiting a real hour to find
  // out whether memory is reclaimed is not a test.
  __test: {
    sweepLoginState,
    loginState,
    failedAttempts,
    FAILED_ATTEMPT_SWEEP_GRACE_MS,
    formatFullReport,
    giftAllMessage,
    GIFT_ALL_KINDS,
    startOfTashkentDay,
    formatOrder,
    ORDER_ID_RE,
    paymeSampleReport,
    paymeSamplePaste,
    PAYME_SAMPLE_TYPES,
    formatReferralBoard,
    formatSalesReport,
    salesLines,
    REFERRAL_TOP_N,
    GIFT_UNLOCK_CREDITS,
  },
};
