// ForStatistic -- a paid advertising board anyone can buy a place on.
//
// The whole product is one rule: the ranking is "who has put in the most".
// That is what makes it worth buying into and what makes topping up worth
// doing, so the amount a person names is not a price -- it IS the thing they
// are buying. Every screen here exists to make that rule visible: the board
// shows the money next to each place, the amount prompt shows what #1
// currently costs, and paying again adds to your total rather than replacing
// it.
//
// An ad is created BEFORE payment (inactive, 0 so'm) so the order can point
// at it by id, and only appears on the board once money actually lands --
// see the "adboard" branch of deliverPaidOrder in index.js.
const { Markup } = require("telegraf");
const { getLanguage, createAd, getAd, listTopAds, listAllAds, setAdActive, isAdmin } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { buildPaymentOptions, withPaymentNote } = require("./checkout");
const { AD_MIN_SOM, AD_MAX_SOM, isValidAdAmount } = require("./orders");
const { safeAnswerCbQuery } = require("./telegramSafety");

// Every field on an ad is text somebody typed, and all of it is rendered
// into HTML messages. Unescaped, a name containing < or & makes Telegram
// reject the whole message -- so the board would simply fail to render for
// everyone the moment one person used an ampersand in their business name.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// How many places exist at all, and how many fit on one screen.
const BOARD_LIMIT = 50;
const PAGE_SIZE = 10;

const NAME_MAX = 40;
const ABOUT_MAX = 100;
const LINK_MAX = 200;
// The board prints every field for ten ads at once and Telegram refuses a
// text message over 4096 characters. A full-length link is the one field
// that can be long enough to matter, so the list shows a shortened form and
// the detail view shows it whole.
const LINK_LIST_MAX = 50;

const RANK_MARKS = ["🥇", "🥈", "🥉"];
const rankMark = (index) => RANK_MARKS[index] || "🔸";

// The currency word, per language. Not worth an i18n key of its own -- it is
// one word and it never appears alone.
const MONEY_UNIT = { uz: "so'm", ru: "сум", en: "so'm" };
const money = (som, lang) =>
  `${Number(som).toLocaleString("uz-UZ")} ${MONEY_UNIT[lang] || MONEY_UNIT.uz}`;

// Every main-menu label, in every language. Someone halfway through the ad
// wizard who taps a menu button means "take me there", never "file this
// button's name as my ad name" -- see the text handler below.
const MENU_LABELS = new Set(Object.values(STRINGS).flatMap((dict) => Object.values(dict.menu)));

// --- the draft being composed -------------------------------------------------
//
// Swept on a timer, like every other in-memory map in this codebase: without
// it, one entry per person who ever started the wizard and abandoned it would
// be held for the life of the process.
const drafts = new Map(); // userId -> { step, name, link, about, mediaFileId, at }
const DRAFT_TTL_MS = 60 * 60 * 1000;

function sweepDrafts(now = Date.now()) {
  let removed = 0;
  for (const [userId, draft] of drafts) {
    if (now - draft.at > DRAFT_TTL_MS) {
      drafts.delete(userId);
      removed++;
    }
  }
  return removed;
}
setInterval(() => sweepDrafts(), DRAFT_TTL_MS).unref();

function setDraft(userId, patch) {
  const current = drafts.get(String(userId)) || {};
  const next = { ...current, ...patch, at: Date.now() };
  drafts.set(String(userId), next);
  return next;
}

const getDraft = (userId) => drafts.get(String(userId)) || null;
const clearDraft = (userId) => drafts.delete(String(userId));

// --- validation ---------------------------------------------------------------

// http/https only. A link on this board is shown to every user of the bot and
// is one tap from opening, so a `javascript:` or `data:` URL has no business
// being accepted -- and anything that is not a parseable absolute URL is a
// typo the person should fix now rather than discover after paying.
function normaliseLink(raw) {
  const text = String(raw || "").trim();
  if (!text || text.length > LINK_MAX || /\s/.test(text)) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

// "50 000", "50000 so'm" and "50,000" are all the same intention. Anything
// with no digits at all is not.
function parseAmount(raw) {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

const shorten = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

// --- rendering ----------------------------------------------------------------

// "/ad_12" is a real bot command, so Telegram renders it as a tappable link
// with no keyboard button needed -- which is what lets fifty entries each
// carry their own "open this one" without fifty buttons.
const adCommand = (id) => `/ad_${id}`;

function boardKeyboard(lang, { page, pages, admin = false }) {
  const rows = [];
  if (pages > 1) {
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback(t(lang, "forStatisticPrevButton"), `fs:page:${page - 1}`));
    if (page < pages) nav.push(Markup.button.callback(t(lang, "forStatisticNextButton"), `fs:page:${page + 1}`));
    rows.push(nav);
  }
  // The two actions sit on their own rows rather than side by side: both
  // labels run to about 25 characters, and Telegram splits a shared row
  // evenly, which would truncate each of them mid-word on a phone.
  rows.push([Markup.button.callback(t(lang, "forStatisticAddButton"), "fs:add")]);
  rows.push([Markup.button.callback(t(lang, "forStatisticInfoButton"), "fs:info")]);
  // Added only for an admin, so moderation is reachable from the same screen
  // the ads are on rather than through a command nobody remembers. Everyone
  // else never sees that this row exists.
  if (admin) rows.push([Markup.button.callback("🛡 Moderatsiya", "fs:mod")]);
  return Markup.inlineKeyboard(rows);
}

function renderBoard(ads, page, lang) {
  if (ads.length === 0) {
    return { text: t(lang, "forStatisticBoardEmpty"), pages: 1, page: 1 };
  }

  const pages = Math.max(1, Math.ceil(ads.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * PAGE_SIZE;
  const slice = ads.slice(start, start + PAGE_SIZE);

  const body = slice
    .map((ad, i) => {
      const place = start + i + 1;
      return t(lang, "forStatisticEntry")({
        mark: rankMark(place - 1),
        place,
        command: adCommand(ad.id),
        name: escapeHtml(shorten(ad.name, NAME_MAX)),
        about: escapeHtml(ad.about),
        link: escapeHtml(shorten(ad.link, LINK_LIST_MAX)),
        money: money(ad.amountSom, lang),
      });
    })
    .join("\n");

  const text =
    `${t(lang, "forStatisticBoardTitle")}\n${body}\n` +
    t(lang, "forStatisticBoardFooter")(current, pages, ads.length);

  return { text, pages, page: current };
}

async function showBoard(ctx, lang, page = 1) {
  const ads = await listTopAds(BOARD_LIMIT);
  const view = renderBoard(ads, page, lang);
  // A failed admin lookup must not cost anybody the board -- it only decides
  // whether one extra button is drawn.
  const admin = await isAdmin(ctx.from.id).catch(() => false);
  await ctx.reply(view.text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...boardKeyboard(lang, { ...view, admin }),
  });
}

// --- the promo that rides along with the main menu -----------------------------

// Required lazily: menu.js calls this, and this module needs mainMenuKeyboard
// from menu.js in the wizard below. A top-level require in both directions is
// a cycle, so the direction used least often is the lazy one -- the same
// pattern vipChat.js/vipInvite.js already use here.
async function sendPromo(ctx, lang) {
  await ctx.reply(t(lang, "forStatisticPromo"), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, "forStatisticPromoButton"), "fs:open")]]),
  });
}

// --- moderation ------------------------------------------------------------------
//
// Every ad is a picture and a link chosen by a member of the public and shown
// to every user of the bot. Payment is friction, not vetting -- a scam is
// exactly as payable as a coffee shop -- so there has to be a way to take one
// down from wherever the operator happens to be.
//
// Admin-only, and invisible rather than refused: somebody who is not an admin
// gets no button, no reply and no hint that any of this exists. The screen
// carries live ids, owners' Telegram ids and what each of them paid.
//
// Uzbek-only, like every other operator-facing surface here (adminBot.js) --
// it is read by the handful of people who run the bot, not by its users.
const ADS_ADMIN_LIMIT = 20;

const ADS_COMMAND = "/afishalar";

// Hidden ads are listed too, and marked. The whole point of this screen is
// seeing what the public board is NOT showing, which a list of live ads could
// never answer.
function formatAdList(ads, total) {
  if (ads.length === 0) {
    return "📊 <b>ForStatistic afishalari</b>\n\nHozircha to'langan afisha yo'q.";
  }

  const rows = ads.map((ad, i) => {
    const state = ad.active ? "✅ Ko'rinmoqda" : "🚫 Yashirilgan";
    const action = ad.active ? `/adhide_${ad.id}` : `/adshow_${ad.id}`;
    return (
      `${i + 1}. <b>#${ad.id}</b> — ${state}\n` +
      `📌 ${escapeHtml(ad.name)}\n` +
      `💬 ${escapeHtml(ad.about)}\n` +
      `🔗 ${escapeHtml(ad.link)}\n` +
      `👤 <code>${escapeHtml(String(ad.userId))}</code>  ·  💰 ${money(ad.amountSom, "uz")}\n` +
      `${action}`
    );
  });

  return (
    `📊 <b>ForStatistic afishalari</b>\n\n` +
    `Jami: <b>${total}</b> ta` +
    (total > ads.length ? ` (eng yuqori ${ads.length} tasi ko'rsatilmoqda)` : "") +
    `\n\n${rows.join("\n\n")}`
  );
}

async function showAdList(ctx) {
  let ads;
  try {
    ads = await listAllAds(100);
  } catch (err) {
    console.error("Could not list ForStatistic ads:", err.message);
    await ctx.reply(`⚠️ Afishalarni o'qib bo'lmadi: ${err.message}`);
    return;
  }
  await ctx.reply(formatAdList(ads.slice(0, ADS_ADMIN_LIMIT), ads.length), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

// --- the add-an-ad wizard -------------------------------------------------------

const STEP = { NAME: "name", PHOTO: "photo", LINK: "link", ABOUT: "about", AMOUNT: "amount" };

async function startWizard(ctx, lang) {
  setDraft(ctx.from.id, { step: STEP.NAME });
  await ctx.reply(t(lang, "forStatisticAskName"), { parse_mode: "HTML" });
}

// The last step: the ad row is written now (inactive, no money on it yet) so
// the order can reference it, then the usual checkout buttons are offered.
// Nothing is shown on the board until the payment actually settles.
async function finishWizard(ctx, lang, draft, amountSom) {
  const adId = await createAd({
    userId: ctx.from.id,
    name: draft.name,
    about: draft.about,
    link: draft.link,
    mediaFileId: draft.mediaFileId,
  });

  const payment = await buildPaymentOptions(ctx.from.id, {
    type: "adboard",
    targetId: adId,
    amountSom,
    lang,
    t,
  });

  const summary = t(lang, "forStatisticDraftReady")({
    name: escapeHtml(draft.name),
    about: escapeHtml(draft.about),
    link: escapeHtml(draft.link),
    money: money(amountSom, lang),
  });

  clearDraft(ctx.from.id);

  if (!payment.configured) {
    await ctx.reply(summary, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, "payButtonGeneric"), "payments:noop")]]),
    });
    return;
  }

  await ctx.reply(withPaymentNote(summary, payment.note), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard(payment.rows),
  });
}

// --- handlers -------------------------------------------------------------------

function registerForStatisticHandlers(bot) {
  const labels = Object.values(STRINGS).map((dict) => dict.menu.forStatistic);

  // Registered from index.js before every bot.hears, so somebody mid-wizard
  // has their message taken as the answer to the step they are on rather than
  // matched against a menu label that happens to appear in what they typed.
  bot.on("text", async (ctx, next) => {
    const draft = getDraft(ctx.from.id);
    if (!draft) return next();

    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;

    // Tapping a menu button mid-wizard means "I changed my mind, take me
    // there" -- the draft is dropped and the update carries on to whichever
    // handler owns that button (all registered after this one).
    if (MENU_LABELS.has(ctx.message.text)) {
      clearDraft(ctx.from.id);
      return next();
    }

    const text = ctx.message.text.trim();

    if (draft.step === STEP.NAME) {
      if (text.length < 2 || text.length > NAME_MAX) {
        await ctx.reply(t(lang, "forStatisticErrName"));
        return;
      }
      setDraft(ctx.from.id, { step: STEP.PHOTO, name: text });
      await ctx.reply(t(lang, "forStatisticAskPhoto"), { parse_mode: "HTML" });
      return;
    }

    if (draft.step === STEP.PHOTO) {
      await ctx.reply(t(lang, "forStatisticErrPhoto"), { parse_mode: "HTML" });
      return;
    }

    if (draft.step === STEP.LINK) {
      const link = normaliseLink(text);
      if (!link) {
        await ctx.reply(t(lang, "forStatisticErrLink"), { parse_mode: "HTML" });
        return;
      }
      setDraft(ctx.from.id, { step: STEP.ABOUT, link });
      await ctx.reply(t(lang, "forStatisticAskAbout"), { parse_mode: "HTML" });
      return;
    }

    if (draft.step === STEP.ABOUT) {
      if (text.length < 5 || text.length > ABOUT_MAX) {
        await ctx.reply(t(lang, "forStatisticErrAbout"));
        return;
      }
      setDraft(ctx.from.id, { step: STEP.AMOUNT, about: text });
      const top = (await listTopAds(1))[0];
      await ctx.reply(
        t(lang, "forStatisticAskAmount")({
          minMoney: money(AD_MIN_SOM, lang),
          topMoney: top ? money(top.amountSom, lang) : null,
        }),
        { parse_mode: "HTML" }
      );
      return;
    }

    if (draft.step === STEP.AMOUNT) {
      const amount = parseAmount(text);
      if (!isValidAdAmount(amount)) {
        await ctx.reply(
          t(lang, "forStatisticErrAmount")({
            minMoney: money(AD_MIN_SOM, lang),
            maxMoney: money(AD_MAX_SOM, lang),
          }),
          { parse_mode: "HTML" }
        );
        return;
      }
      await finishWizard(ctx, lang, { ...drafts.get(String(ctx.from.id)) }, amount);
      return;
    }

    return next();
  });

  // The photo step. Same early registration, same reason.
  bot.on("photo", async (ctx, next) => {
    const draft = getDraft(ctx.from.id);
    if (!draft || draft.step !== STEP.PHOTO) return next();

    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    setDraft(ctx.from.id, { step: STEP.LINK, mediaFileId: fileId });
    await ctx.reply(t(lang, "forStatisticAskLink"), { parse_mode: "HTML", disable_web_page_preview: true });
  });

  bot.hears(labels, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await showBoard(ctx, lang, 1);
  });

  bot.action("fs:open", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await showBoard(ctx, lang, 1);
  });

  bot.action(/^fs:page:(\d+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await showBoard(ctx, lang, Number(ctx.match[1]));
  });

  bot.action("fs:info", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await ctx.reply(t(lang, "forStatisticInfo"), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, "forStatisticAddButton"), "fs:add")],
        [Markup.button.callback(t(lang, "forStatisticBoardButton"), "fs:open")],
      ]),
    });
  });

  bot.action("fs:add", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await startWizard(ctx, lang);
  });

  // --- moderation, admin only -------------------------------------------------
  //
  // Every one of these falls through with next() for a non-admin rather than
  // refusing: a refusal confirms the command exists. Someone who is not an
  // admin sees the same nothing they would see for any unknown command.
  const adminOnly = (handler) => async (ctx, next) => {
    if (!(await isAdmin(ctx.from.id).catch(() => false))) return next();
    return handler(ctx);
  };

  bot.action(
    "fs:mod",
    adminOnly(async (ctx) => {
      await safeAnswerCbQuery(ctx);
      await showAdList(ctx);
    })
  );

  bot.hears(ADS_COMMAND, adminOnly(async (ctx) => showAdList(ctx)));

  bot.hears(
    /^\/adhide_(\d+)$/,
    adminOnly(async (ctx) => {
      const id = ctx.match[1];
      const ad = await setAdActive(id, false);
      await ctx.reply(ad ? `🚫 Afisha #${id} yashirildi.` : `Afisha #${id} topilmadi.`);
      if (ad) console.log(`ForStatistic ad ${id} hidden by admin ${ctx.from.id}`);
    })
  );

  bot.hears(
    /^\/adshow_(\d+)$/,
    adminOnly(async (ctx) => {
      const id = ctx.match[1];
      const ad = await setAdActive(id, true);
      await ctx.reply(ad ? `✅ Afisha #${id} qaytarildi.` : `Afisha #${id} topilmadi.`);
      if (ad) console.log(`ForStatistic ad ${id} shown by admin ${ctx.from.id}`);
    })
  );

  // "/ad_12" -- one entry in full, with the photo the list cannot carry.
  bot.hears(/^\/ad_(\d+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const id = ctx.match[1];

    const ad = await getAd(id);
    // A hidden ad is answered exactly like one that never existed: an ad
    // taken off the board by a moderator must not stay reachable by id.
    if (!ad || !ad.active || ad.amountSom <= 0) {
      await ctx.reply(t(lang, "forStatisticAdGone"));
      return;
    }

    const ads = await listTopAds(BOARD_LIMIT);
    const index = ads.findIndex((row) => String(row.id) === String(ad.id));
    const place = index === -1 ? ads.length + 1 : index + 1;

    const caption = t(lang, "forStatisticDetail")({
      mark: rankMark(place - 1),
      place,
      id: escapeHtml(ad.id),
      name: escapeHtml(ad.name),
      about: escapeHtml(ad.about),
      link: escapeHtml(ad.link),
      money: money(ad.amountSom, lang),
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t(lang, "forStatisticOpenLinkButton"), ad.link)],
      [Markup.button.callback(t(lang, "forStatisticBoardButton"), "fs:open")],
    ]);

    if (ad.mediaFileId) {
      try {
        await ctx.replyWithPhoto(ad.mediaFileId, { caption, parse_mode: "HTML", ...keyboard });
        return;
      } catch (err) {
        // A file_id can stop resolving (Telegram expiring it, the original
        // message deleted). The ad was paid for, so it still has to be
        // readable -- text without the picture beats an error.
        console.error(`ForStatistic: photo for ad ${ad.id} failed, falling back to text:`, err.message);
      }
    }
    await ctx.reply(caption, { parse_mode: "HTML", disable_web_page_preview: true, ...keyboard });
  });
}

module.exports = {
  registerForStatisticHandlers,
  sendPromo,
  showBoard,
  BOARD_LIMIT,
  PAGE_SIZE,
  __test: {
    renderBoard,
    normaliseLink,
    parseAmount,
    rankMark,
    money,
    drafts,
    sweepDrafts,
    DRAFT_TTL_MS,
    formatAdList,
    ADS_COMMAND,
    ADS_ADMIN_LIMIT,
    escapeHtml,
    NAME_MAX,
    ABOUT_MAX,
  },
};
