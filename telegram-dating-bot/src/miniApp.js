const crypto = require("crypto");
const {
  getProfile, hasPremium, hasAnonGenderFilter, hasVipChat, getLanguage,
} = require("./db");
const {
  createOrder, buildCheckoutUrl,
  PREMIUM_PRICE_SOM, PREMIUM_DAYS, VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM, ANON_GENDER_DAYS,
} = require("./click");
const { VIP_CHAT_INVITE_LINK } = require("./vipChat");
const { pendingLikerCount } = require("./discover");
const { isRegistered } = require("./profileState");
const { DEFAULT_LANG } = require("./i18n");

// --- Who is actually asking -------------------------------------------------
//
// A Mini App runs as an ordinary web page: the "user id" it reports is just a
// number sitting in browser JavaScript, and anyone can open the page with a
// different one. Telegram's answer is initData -- the same fields, signed with
// the bot token. Verifying that signature is the ONLY thing separating "this
// is user 6342359181" from "this person typed 6342359181", and everything
// below (balances, subscriptions, buying) depends on it. Nothing in here ever
// trusts a user id that did not survive this check.
//
// The scheme is Telegram's: build a newline-joined, key-sorted string of every
// field except `hash`, HMAC it with a secret that is itself HMAC(botToken)
// keyed by the constant "WebAppData", and compare.
const MAX_INIT_DATA_AGE_S = 24 * 60 * 60;

function verifyInitData(initData, botToken) {
  if (!initData || typeof initData !== "string") return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  // Timing-safe, and length-checked first because timingSafeEqual throws on a
  // length mismatch rather than returning false.
  let a;
  let b;
  try {
    a = Buffer.from(expected, "hex");
    b = Buffer.from(hash, "hex");
  } catch {
    return null;
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // A correctly signed initData is still a replayable credential -- someone
  // who captured one months ago must not be able to reuse it forever.
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return null;
  if (Math.floor(Date.now() / 1000) - authDate > MAX_INIT_DATA_AGE_S) return null;

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || typeof user.id !== "number") return null;
    return user;
  } catch {
    return null;
  }
}

// Header rather than a query string or a body: a query string ends up in
// server logs and Referer headers, and a body would need a parser mounted on
// this app -- which is exactly what once broke the Telegram webhook here (see
// the note in index.js about scoping body parsers).
const INIT_DATA_HEADER = "x-telegram-init-data";

function requireTelegramUser(botToken) {
  return (req, res, next) => {
    const user = verifyInitData(req.get(INIT_DATA_HEADER), botToken);
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.telegramUser = user;
    next();
  };
}

function dateOnly(iso) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : null;
}

function activeUntil(iso) {
  if (!iso) return null;
  const when = new Date(iso);
  return when.getTime() > Date.now() ? dateOnly(iso) : null;
}

// Everything the page needs in a single round trip -- one request on open,
// rather than a handful the user would watch pop in one by one.
async function buildState(userId) {
  const profile = await getProfile(userId);
  const [premium, anonFilter, vip] = await Promise.all([
    hasPremium(userId),
    hasAnonGenderFilter(userId),
    hasVipChat(userId),
  ]);

  const registered = isRegistered(profile);
  return {
    registered,
    profile: registered
      ? {
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          genderLabel: profile.genderLabel,
          location: profile.location,
          bio: profile.bio,
          hasPhoto: !!profile.mediaFileId,
          isVideo: profile.mediaType === "video",
        }
      : null,
    likes: registered ? await pendingLikerCount(userId) : 0,
    subscriptions: {
      premium: { active: premium, until: activeUntil(profile?.premiumUntil), price: PREMIUM_PRICE_SOM, days: PREMIUM_DAYS },
      // Premium includes this one, which is why it can read as active with no
      // date of its own -- the page says so rather than showing a blank.
      anonFilter: {
        active: anonFilter,
        until: activeUntil(profile?.anonGenderUntil),
        viaPremium: anonFilter && !activeUntil(profile?.anonGenderUntil),
        price: ANON_GENDER_PRICE_SOM,
        days: ANON_GENDER_DAYS,
      },
      // Women join the VIP chat free -- the same rule vipChat.js enforces.
      vip: { active: vip, price: VIP_CHAT_PRICE_SOM, freeForMe: profile?.gender === "female" },
    },
    vipLink: vip || profile?.gender === "female" ? VIP_CHAT_INVITE_LINK : null,
    paymentsConfigured: !!buildCheckoutUrl("probe", 1),
  };
}

const ORDER_TYPES = new Set(["premium", "vipchat", "anongender"]);

function registerMiniApp(app, { botToken, telegram }) {
  const auth = requireTelegramUser(botToken);

  app.get("/app", (req, res) => res.type("html").send(renderMiniAppHtml()));

  app.get("/api/state", auth, async (req, res) => {
    try {
      res.json(await buildState(req.telegramUser.id));
    } catch (err) {
      console.error("mini app state failed:", err.message);
      res.status(500).json({ error: "state_failed" });
    }
  });

  // Streamed through this server rather than handed to the browser as a
  // Telegram file URL: those URLs embed the bot token, so redirecting to one
  // would publish the token to every user who opens the app.
  app.get("/api/photo", auth, async (req, res) => {
    try {
      const profile = await getProfile(req.telegramUser.id);
      if (!profile?.mediaFileId || profile.mediaType === "video") {
        res.status(404).end();
        return;
      }
      const link = await telegram.getFileLink(profile.mediaFileId);
      const upstream = await fetch(String(link));
      if (!upstream.ok) {
        res.status(502).end();
        return;
      }
      res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
      res.set("Cache-Control", "private, max-age=300");
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      console.error("mini app photo failed:", err.message);
      res.status(500).end();
    }
  });

  // The price is never taken from the request -- only the product name is, and
  // createOrder looks the amount up itself. A tampered "amount" would
  // otherwise buy Premium for 1 so'm.
  app.post("/api/order", auth, async (req, res) => {
    const type = String(req.query.type || "");
    if (!ORDER_TYPES.has(type)) {
      res.status(400).json({ error: "unknown_type" });
      return;
    }
    try {
      const userId = req.telegramUser.id;
      if (type === "vipchat") {
        const profile = await getProfile(userId);
        // Same server-side re-check vipChat.js does: a forged request must not
        // be able to buy what it is supposed to get free, or vice versa.
        if (profile?.gender === "female") {
          res.json({ free: true, link: VIP_CHAT_INVITE_LINK });
          return;
        }
      }
      const orderId = await createOrder(userId, { type });
      const amount =
        type === "premium" ? PREMIUM_PRICE_SOM : type === "vipchat" ? VIP_CHAT_PRICE_SOM : ANON_GENDER_PRICE_SOM;
      const url = buildCheckoutUrl(orderId, amount);
      if (!url) {
        res.json({ configured: false });
        return;
      }
      res.json({ configured: true, url });
    } catch (err) {
      console.error("mini app order failed:", err.message);
      res.status(500).json({ error: "order_failed" });
    }
  });
}

// A single self-contained page: no CDN, no build step, and no external
// requests, so it loads instantly on a phone on mobile data and cannot be
// broken by someone else's CDN going down.
function renderMiniAppHtml() {
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ForOne ∞</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  /* Every colour comes from Telegram's theme variables, so the app follows
     whatever theme the person actually uses instead of forcing one. */
  :root {
    --bg: var(--tg-theme-bg-color, #17181a);
    --card: var(--tg-theme-secondary-bg-color, #232427);
    --text: var(--tg-theme-text-color, #f2f2f3);
    --hint: var(--tg-theme-hint-color, #8b8e94);
    --link: var(--tg-theme-link-color, #5aa9f8);
    --btn: var(--tg-theme-button-color, #5aa9f8);
    --btn-text: var(--tg-theme-button-text-color, #ffffff);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; padding: 16px 16px 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text);
    max-width: 560px; margin-inline: auto;
  }
  .hero { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .avatar {
    width: 68px; height: 68px; border-radius: 50%; object-fit: cover; flex: 0 0 auto;
    background: var(--card); display: grid; place-items: center; font-size: 30px;
  }
  .hero h1 { font-size: 1.25rem; margin: 0 0 2px; }
  .hero .sub { color: var(--hint); font-size: .88rem; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .stat { background: var(--card); border-radius: 14px; padding: 14px; }
  .stat .n { font-size: 1.5rem; font-weight: 700; }
  .stat .l { color: var(--hint); font-size: .8rem; margin-top: 2px; }
  h2 { font-size: .82rem; text-transform: uppercase; letter-spacing: .04em;
       color: var(--hint); margin: 22px 0 8px; font-weight: 600; }
  .card {
    background: var(--card); border-radius: 14px; padding: 14px;
    display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
    border: none; width: 100%; text-align: left; font: inherit; color: inherit;
    cursor: pointer; transition: transform .08s ease;
  }
  .card:active { transform: scale(.985); }
  .card .icon { font-size: 26px; flex: 0 0 auto; width: 34px; text-align: center; }
  .card .body { flex: 1 1 auto; min-width: 0; }
  .card .title { font-weight: 600; margin-bottom: 3px; }
  .card .desc { color: var(--hint); font-size: .82rem; line-height: 1.35; }
  .badge {
    flex: 0 0 auto; font-size: .72rem; padding: 4px 9px; border-radius: 999px;
    font-weight: 600; white-space: nowrap;
  }
  .badge.on { background: rgba(52,199,89,.16); color: #34c759; }
  .badge.off { background: rgba(255,255,255,.08); color: var(--hint); }
  .empty { background: var(--card); border-radius: 14px; padding: 22px 16px; text-align: center; }
  .empty .big { font-size: 40px; margin-bottom: 8px; }
  .empty p { color: var(--hint); margin: 0; line-height: 1.5; font-size: .9rem; }
  .note { color: var(--hint); font-size: .78rem; text-align: center; margin-top: 18px; line-height: 1.5; }
  .skeleton { animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .45; } }
</style>
</head>
<body>
<div id="root" class="skeleton">
  <div class="hero">
    <div class="avatar">⏳</div>
    <div><h1>Yuklanmoqda…</h1><div class="sub">Bir soniya</div></div>
  </div>
</div>

<script>
const tg = window.Telegram?.WebApp;
const root = document.getElementById("root");

// Telegram's own chrome, used rather than reimplemented: full height, header
// tinted to match the page, and a confirmation if they swipe away mid-payment.
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("secondary_bg_color"); } catch {}
  tg.enableClosingConfirmation();
}

function haptic(kind) {
  try { tg.HapticFeedback.impactOccurred(kind || "light"); } catch {}
}
function notify(kind) {
  try { tg.HapticFeedback.notificationOccurred(kind); } catch {}
}
// A space, not a comma: the browser's uz-UZ locale renders 79,900 while
// every price the bot itself writes is 79 900.
//
// Deliberately written without a regex. This whole script is embedded in a
// Node template literal, which eats unrecognised backslash escapes -- \\B and
// \\d silently shipped as plain B and d, leaving a regex that matched nothing
// and prices with no separator at all. Nothing here uses a backslash, so that
// class of bug cannot come back.
function money(n) {
  const digits = String(n);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return out + " so'm";
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { "X-Telegram-Init-Data": tg?.initData || "", ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}

let state = null;

async function load() {
  state = await (await api("/api/state")).json();
  render();
  if (state.profile?.hasPhoto && !state.profile.isVideo) loadPhoto();
}

// Fetched with the signed header and shown as a blob, because an <img src>
// cannot carry one -- and the endpoint must stay authenticated.
async function loadPhoto() {
  try {
    const blob = await (await api("/api/photo")).blob();
    const img = document.querySelector(".avatar");
    if (img) img.outerHTML = '<img class="avatar" alt="" src="' + URL.createObjectURL(blob) + '">';
  } catch {}
}

function subCard(id, icon, title, desc, active, badgeOn, badgeOff) {
  return '<button class="card" data-action="' + id + '">' +
    '<div class="icon">' + icon + '</div>' +
    '<div class="body"><div class="title">' + esc(title) + '</div>' +
    '<div class="desc">' + desc + '</div></div>' +
    '<div class="badge ' + (active ? "on" : "off") + '">' + (active ? badgeOn : badgeOff) + '</div>' +
    '</button>';
}

function render() {
  if (!state.registered) {
    root.classList.remove("skeleton");
    root.innerHTML =
      '<div class="empty"><div class="big">📝</div>' +
      '<p>Sizda hali anketa yo\\'q.<br>Botga qaytib <b>/start</b> orqali anketa to\\'ldiring, keyin bu yerga qayting.</p></div>';
    tg?.MainButton.setText("Botga qaytish").show().onClick(() => tg.close());
    return;
  }

  const p = state.profile;
  const s = state.subscriptions;

  const premiumDesc = s.premium.active
    ? "Faol — " + esc(s.premium.until) + " gacha"
    : "Cheklovsiz profil ko'rish · " + s.premium.days + " kun";

  const anonDesc = s.anonFilter.viaPremium
    ? "Faol — Premium orqali"
    : s.anonFilter.active
      ? "Faol — " + esc(s.anonFilter.until) + " gacha"
      : "Anonim chatda jinsni tanlash · " + s.anonFilter.days + " kun";

  const vipDesc = s.vip.active
    ? "Ochiq — kanalga o'tish"
    : s.vip.freeForMe
      ? "Qizlar uchun bepul — kirish"
      : "Yopiq guruh — bir martalik to'lov";

  root.classList.remove("skeleton");
  root.innerHTML =
    '<div class="hero">' +
      '<div class="avatar">' + (p.gender === "female" ? "👩" : "👨") + '</div>' +
      '<div><h1>' + esc(p.name) + ', ' + esc(p.age) + '</h1>' +
      '<div class="sub">' + esc(p.genderLabel || "") + ' · ' + esc(p.location || "") + '</div></div>' +
    '</div>' +

    '<div class="stats">' +
      '<div class="stat"><div class="n">' + state.likes + '</div><div class="l">Sizni yoqtirganlar</div></div>' +
      '<div class="stat"><div class="n">' + (s.premium.active ? "💎" : "—") + '</div>' +
      '<div class="l">' + (s.premium.active ? "Premium faol" : "Premium yo\\'q") + '</div></div>' +
    '</div>' +

    '<h2>Obunalarim</h2>' +
    subCard("premium", "💎", "Premium", premiumDesc, s.premium.active, "Faol", money(s.premium.price)) +
    subCard("anongender", "🕵️", "Anonim chat — jins tanlash", anonDesc, s.anonFilter.active, "Faol", money(s.anonFilter.price)) +
    subCard("vipchat", "👑", "VIP suhbat", vipDesc, s.vip.active || s.vip.freeForMe, s.vip.active ? "Ochiq" : "Bepul", money(s.vip.price)) +

    '<h2>Bot</h2>' +
    '<button class="card" data-action="discover"><div class="icon">🔍</div>' +
      '<div class="body"><div class="title">Yangi tanishuvlar</div>' +
      '<div class="desc">Botga qaytib anketalarni ko\\'rish</div></div></button>' +
    '<button class="card" data-action="likes"><div class="icon">💌</div>' +
      '<div class="body"><div class="title">Kimlar yoqtirdi</div>' +
      '<div class="desc">' + (state.likes > 0 ? state.likes + " ta yangi" : "Hozircha yo\\'q") + '</div></div></button>' +

    (state.paymentsConfigured ? "" :
      '<div class="note">⚠️ To\\'lov tizimi hali sozlanmagan — sotib olish vaqtincha ishlamaydi.</div>') +
    '<div class="note">ID: ' + (tg?.initDataUnsafe?.user?.id ?? "—") + '</div>';

  // The primary action is whatever this particular person hasn't got yet, put
  // on Telegram's own MainButton instead of a button of our own.
  if (!s.premium.active) {
    tg?.MainButton.setText("💎 Premium olish — " + money(s.premium.price)).show()
      .offClick(onMain).onClick(onMain);
  } else {
    tg?.MainButton.hide();
  }

  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => onAction(el.dataset.action));
  });
}

function onMain() { onAction("premium"); }

async function onAction(action) {
  haptic("medium");

  if (action === "discover" || action === "likes") {
    tg?.close();
    return;
  }

  const s = state.subscriptions;
  if (action === "vipchat" && (s.vip.active || s.vip.freeForMe) && state.vipLink) {
    tg?.openTelegramLink(state.vipLink);
    return;
  }
  if (action === "premium" && s.premium.active) {
    tg?.showPopup({ title: "💎 Premium", message: "Obunangiz " + s.premium.until + " gacha faol." });
    return;
  }
  if (action === "anongender" && s.anonFilter.active) {
    tg?.showPopup({
      title: "🕵️ Jins tanlash",
      message: s.anonFilter.viaPremium
        ? "Premium obunangiz orqali faol — 👧 va 👦 ikkalasi ham ishlaydi."
        : "Obuna " + s.anonFilter.until + " gacha faol — 👧 va 👦 ikkalasi ham ishlaydi.",
    });
    return;
  }

  try {
    const data = await (await api("/api/order?type=" + encodeURIComponent(action), { method: "POST" })).json();
    if (data.free && data.link) { tg?.openTelegramLink(data.link); return; }
    if (!data.configured) {
      notify("warning");
      tg?.showPopup({ title: "Hozircha mumkin emas", message: "To'lov tizimi hali sozlanmagan. Tez orada ishga tushadi." });
      return;
    }
    notify("success");
    tg?.openLink(data.url);
  } catch (err) {
    notify("error");
    tg?.showPopup({ title: "Xatolik", message: "Qayta urinib ko'ring." });
  }
}

load().catch(() => {
  root.classList.remove("skeleton");
  root.innerHTML = '<div class="empty"><div class="big">⚠️</div>' +
    '<p>Ma\\'lumotlarni yuklab bo\\'lmadi.<br>Ilovani yopib, qaytadan oching.</p></div>';
});
</script>
</body>
</html>`;
}

module.exports = { registerMiniApp, verifyInitData, renderMiniAppHtml };
