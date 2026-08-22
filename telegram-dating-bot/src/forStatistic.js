// ForStatistic -- a paid advertising board anyone can buy a place on.
//
// The whole product is one rule: the ranking is "who has put in the most",
// and paying again ADDS to your total rather than replacing it. Everything
// here exists to make that rule visible and act on it -- the board shows the
// money beside each place, the top-up screen says exactly how much more each
// of the top three would cost, and the top three are shown as full cards
// rather than list rows because that is what people are paying for.
//
// An ad is created BEFORE payment (inactive, 0 so'm) so the order can point
// at it by id, and only appears on the board once money actually lands --
// see the "adboard" branch of deliverPaidOrder in index.js.
const { Markup } = require("telegraf");
const {
  getLanguage,
  createAd,
  getAd,
  listTopAds,
  listAllAds,
  listAdsByUser,
  updateAd,
  setAdActive,
  isAdmin,
} = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { buildPaymentOptions, withPaymentNote } = require("./checkout");
const { AD_MIN_SOM, AD_MAX_SOM, isValidAdAmount } = require("./orders");
const { safeAnswerCbQuery } = require("./telegramSafety");
const { mainMenuKeyboard } = require("./menu");
const { alert } = require("./alerts");

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

const BOARD_LIMIT = 50;
// The top three get full cards; everything below them is paged ten at a time.
const TOP_CARDS = 3;
const PAGE_SIZE = 10;

const NAME_MAX = 40;
const ABOUT_MAX = 100;
const LINK_MAX = 200;
// The list prints every field for ten ads at once and Telegram refuses a text
// message over 4096 characters. A full-length link is the one field long
// enough to matter, so the list shortens it and the card shows it whole.
const LINK_LIST_MAX = 50;

const RANK_MARKS = ["🥇", "🥈", "🥉"];
const rankMark = (index) => RANK_MARKS[index] || "🔸";

const MONEY_UNIT = { uz: "so'm", ru: "сум", en: "so'm" };
const money = (som, lang) =>
  `${Number(som).toLocaleString("uz-UZ")} ${MONEY_UNIT[lang] || MONEY_UNIT.uz}`;

const MENU_LABELS = new Set(Object.values(STRINGS).flatMap((dict) => Object.values(dict.menu)));

// Every label this screen's own keyboard can produce, in every language.
// Collected once so the wizard can tell "they tapped one of my buttons" from
// "this is their answer to the question I asked".
function labelsOf(...keys) {
  return new Set(Object.values(STRINGS).flatMap((dict) => keys.map((k) => dict[k])).filter(Boolean));
}
const FS_BUTTON_LABELS = labelsOf(
  "forStatisticAddButton",
  "forStatisticInfoButton",
  "forStatisticMyAdButton",
  "forStatisticTopUpButton",
  "forStatisticEditButton",
  "forStatisticEditNameButton",
  "forStatisticEditPhotoButton",
  "forStatisticEditLinkButton",
  "forStatisticEditAboutButton",
  "backButton"
);

// --- contact: a link, a Telegram handle, or a phone number ---------------------
//
// Demanding an https URL turned away the two things most advertisers here
// actually have: a Telegram channel they know as "@name", and a phone number.
// All three are accepted and stored in the shape the person typed; the button
// URL and the icon are derived at render time, so no second column is needed.

function normaliseContact(raw) {
  const text = String(raw || "").trim();
  if (!text || text.length > LINK_MAX) return null;

  // "@channel". Telegram usernames are 5-32 characters, starting with a letter.
  const handle = /^@([A-Za-z][A-Za-z0-9_]{4,31})$/.exec(text);
  if (handle) return { value: `@${handle[1]}`, kind: "telegram" };

  // A phone number, however it was spaced or bracketed.
  const digits = text.replace(/[\s()–—-]/g, "");
  if (/^\+?\d{7,15}$/.test(digits)) {
    return { value: digits.startsWith("+") ? digits : `+${digits}`, kind: "phone" };
  }

  // A URL -- http/https only. This board shows every link to every user and
  // puts it one tap from opening, so a javascript: or data: URL has no
  // business being accepted.
  if (/\s/.test(text)) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return { value: url.toString(), kind: "url" };
}

function contactKind(value) {
  const text = String(value || "");
  if (text.startsWith("@")) return "telegram";
  if (/^\+\d+$/.test(text)) return "phone";
  return "url";
}

const CONTACT_ICON = { url: "🔗", telegram: "✈️", phone: "📞" };
const contactIcon = (value) => CONTACT_ICON[contactKind(value)];

// The URL behind the "open" button, or null when there is nothing to open.
// A phone number has no URL an inline button will accept -- Telegram makes a
// phone tappable in the message text by itself, which is the right behaviour
// anyway (it offers calling rather than a browser).
function contactUrl(value) {
  const kind = contactKind(value);
  if (kind === "telegram") return `https://t.me/${String(value).slice(1)}`;
  if (kind === "phone") return null;
  return value;
}

function parseAmount(raw) {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

const shorten = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

// --- where somebody is, and what they are half-way through ---------------------
//
// Both swept on a timer, like every other in-memory map here: without it, one
// entry per person who ever opened the screen would be held for the life of
// the process.
const screens = new Map(); // userId -> { screen, adId, at }
const drafts = new Map(); // userId -> { mode, step, ...fields, at }
const TTL_MS = 60 * 60 * 1000;

function sweepState(now = Date.now()) {
  let removed = 0;
  for (const map of [screens, drafts]) {
    for (const [key, value] of map) {
      if (now - value.at > TTL_MS) {
        map.delete(key);
        removed++;
      }
    }
  }
  return removed;
}
setInterval(() => sweepState(), TTL_MS).unref();

const setScreen = (userId, patch) => {
  const next = { ...(screens.get(String(userId)) || {}), ...patch, at: Date.now() };
  screens.set(String(userId), next);
  return next;
};
const getScreen = (userId) => screens.get(String(userId)) || null;
const clearScreen = (userId) => screens.delete(String(userId));

function setDraft(userId, patch) {
  const next = { ...(drafts.get(String(userId)) || {}), ...patch, at: Date.now() };
  drafts.set(String(userId), next);
  return next;
}
const getDraft = (userId) => drafts.get(String(userId)) || null;
const clearDraft = (userId) => drafts.delete(String(userId));

// --- keyboards ------------------------------------------------------------------
//
// Reply keyboards, docked under the input box, rather than inline buttons
// attached to one message: the board is a place you stay in and act from, and
// an inline row scrolls away the moment anything else is sent.

function boardKeyboard(lang) {
  return Markup.keyboard([
    [t(lang, "forStatisticAddButton"), t(lang, "forStatisticMyAdButton")],
    [t(lang, "forStatisticInfoButton"), t(lang, "backButton")],
  ])
    .resize()
    .persistent();
}

function myAdKeyboard(lang) {
  return Markup.keyboard([
    [t(lang, "forStatisticTopUpButton"), t(lang, "forStatisticEditButton")],
    [t(lang, "backButton")],
  ])
    .resize()
    .persistent();
}

function editKeyboard(lang) {
  return Markup.keyboard([
    [t(lang, "forStatisticEditNameButton"), t(lang, "forStatisticEditPhotoButton")],
    [t(lang, "forStatisticEditLinkButton"), t(lang, "forStatisticEditAboutButton")],
    [t(lang, "backButton")],
  ])
    .resize()
    .persistent();
}

// --- rendering --------------------------------------------------------------------

// "/ad_12" is a real bot command, so Telegram renders it as a tappable link
// with no button needed -- which is what lets fifty rows each carry their own
// "open this one".
const adCommand = (id) => `/ad_${id}`;

function entryFields(ad, place, lang, { short = false } = {}) {
  return {
    mark: rankMark(place - 1),
    place,
    command: adCommand(ad.id),
    id: escapeHtml(ad.id),
    name: escapeHtml(shorten(ad.name, NAME_MAX)),
    about: escapeHtml(ad.about),
    contactIcon: contactIcon(ad.link),
    link: escapeHtml(short ? shorten(ad.link, LINK_LIST_MAX) : ad.link),
    money: money(ad.amountSom, lang),
  };
}

// Places 4 and below. Given the same weight as the top three -- bold name,
// its own money line, its own separator -- because being in the list is not
// being an also-ran; those people paid too.
function renderRest(rest, page, lang) {
  const pages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * PAGE_SIZE;
  const slice = rest.slice(start, start + PAGE_SIZE);

  const body = slice
    .map((ad, i) => t(lang, "forStatisticEntry")(entryFields(ad, TOP_CARDS + start + i + 1, lang, { short: true })))
    .join("\n");

  const text =
    `${t(lang, "forStatisticRestTitle")}\n${body}\n` +
    t(lang, "forStatisticBoardFooter")(current, pages, rest.length + Math.min(TOP_CARDS, rest.length ? TOP_CARDS : 0));

  return { text, pages, page: current };
}

function restKeyboard(lang, { page, pages, admin = false }) {
  const rows = [];
  if (pages > 1) {
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback(t(lang, "forStatisticPrevButton"), `fs:page:${page - 1}`));
    if (page < pages) nav.push(Markup.button.callback(t(lang, "forStatisticNextButton"), `fs:page:${page + 1}`));
    rows.push(nav);
  }
  // Added only for an admin, so moderation is reachable from the screen the
  // ads are actually on. Everybody else never sees that this row exists.
  if (admin) rows.push([Markup.button.callback("🛡 Moderatsiya", "fs:mod")]);
  return rows.length ? Markup.inlineKeyboard(rows) : undefined;
}

// One ad as a full card: its picture, its details, and a button straight to
// whatever contact it carries.
async function sendAdCard(ctx, ad, place, lang, { extraRows = [] } = {}) {
  const caption = t(lang, "forStatisticDetail")(entryFields(ad, place, lang));
  const url = contactUrl(ad.link);
  const rows = [
    ...(url ? [[Markup.button.url(t(lang, "forStatisticOpenLinkButton"), url)]] : []),
    ...extraRows,
  ];
  const extra = {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(rows.length ? Markup.inlineKeyboard(rows) : {}),
  };

  if (ad.mediaFileId) {
    try {
      await ctx.replyWithPhoto(ad.mediaFileId, { caption, ...extra });
      return;
    } catch (err) {
      // A file_id can stop resolving (Telegram expiring it, the original
      // message deleted). The ad was paid for, so it still has to be
      // readable -- text without the picture beats an error.
      console.error(`ForStatistic: photo for ad ${ad.id} failed, falling back to text:`, err.message);
    }
  }
  await ctx.reply(caption, extra);
}

async function showBoard(ctx, lang, page = 1) {
  setScreen(ctx.from.id, { screen: "board" });
  const ads = await listTopAds(BOARD_LIMIT);

  if (ads.length === 0) {
    await ctx.reply(t(lang, "forStatisticBoardEmpty"), {
      parse_mode: "HTML",
      ...boardKeyboard(lang),
    });
    return;
  }

  const admin = await isAdmin(ctx.from.id).catch(() => false);
  const rest = ads.slice(TOP_CARDS);

  // Page one leads with the podium. Later pages are the list alone -- resending
  // three photos every time somebody taps "next" would be noise.
  if (page <= 1) {
    await ctx.reply(t(lang, "forStatisticTop3Title"), { parse_mode: "HTML", ...boardKeyboard(lang) });
    for (const [i, ad] of ads.slice(0, TOP_CARDS).entries()) {
      await sendAdCard(ctx, ad, i + 1, lang);
    }
  }

  if (rest.length === 0) return;

  const view = renderRest(rest, page, lang);
  await ctx.reply(view.text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(restKeyboard(lang, { ...view, admin }) || {}),
  });
}

// --- the promo that rides along with the main menu --------------------------------

async function sendPromo(ctx, lang) {
  await ctx.reply(t(lang, "forStatisticPromo"), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, "forStatisticPromoButton"), "fs:open")]]),
  });
}

// --- my ad -------------------------------------------------------------------------

// Which ad the top-up and edit buttons act on. Almost everybody has exactly
// one; when there are several the highest is selected by default and each
// card carries a button to switch.
async function selectedAdFor(userId) {
  const mine = await listAdsByUser(userId);
  if (mine.length === 0) return { mine, ad: null };
  const chosen = getScreen(userId)?.adId;
  const ad = mine.find((row) => String(row.id) === String(chosen)) || mine[0];
  return { mine, ad };
}

async function showMyAd(ctx, lang) {
  const { mine } = await selectedAdFor(ctx.from.id);

  if (mine.length === 0) {
    setScreen(ctx.from.id, { screen: "board", adId: null });
    await ctx.reply(t(lang, "forStatisticNoAd"), { parse_mode: "HTML", ...boardKeyboard(lang) });
    return;
  }

  setScreen(ctx.from.id, { screen: "myad", adId: mine[0].id });
  await ctx.reply(t(lang, "forStatisticMyAdTitle"), { parse_mode: "HTML", ...myAdKeyboard(lang) });

  const board = await listTopAds(BOARD_LIMIT);
  for (const ad of mine) {
    const index = board.findIndex((row) => String(row.id) === String(ad.id));
    const place = index === -1 ? board.length + 1 : index + 1;
    // A hidden ad is shown to its OWNER, marked. Finding it simply missing
    // with no explanation is worse than being told it was taken down.
    const extraRows =
      mine.length > 1
        ? [[Markup.button.callback(t(lang, "forStatisticPickAdButton"), `fs:pick:${ad.id}`)]]
        : [];
    await sendAdCard(ctx, ad, place, lang, { extraRows });
    if (!ad.active) await ctx.reply(t(lang, "forStatisticMyAdHidden"), { parse_mode: "HTML" });
  }
}

// --- topping up ---------------------------------------------------------------------

// How much more each of the top three places would cost. Computed against
// everybody ELSE, so the person's own row never counts as an obstacle to
// themselves -- and +1 because ties are broken by who paid first, so matching
// an amount does not overtake it.
function gapsFor(board, ad) {
  const others = board.filter((row) => String(row.id) !== String(ad.id));
  const gaps = [];
  for (let place = 1; place <= TOP_CARDS; place++) {
    const holder = others[place - 1];
    if (!holder) break;
    const need = holder.amountSom - ad.amountSom + 1;
    if (need > 0) gaps.push({ place, need });
  }
  return gaps;
}

async function askTopUp(ctx, lang) {
  const { ad } = await selectedAdFor(ctx.from.id);
  if (!ad) {
    await showMyAd(ctx, lang);
    return;
  }

  const board = await listTopAds(BOARD_LIMIT);
  const index = board.findIndex((row) => String(row.id) === String(ad.id));
  const place = index === -1 ? board.length + 1 : index + 1;
  const gaps = gapsFor(board, ad);

  const gapsBlock =
    gaps.length === 0
      ? t(lang, "forStatisticAlreadyTop")
      : t(lang, "forStatisticGapsHeader") +
        gaps
          .map((gap) =>
            t(lang, "forStatisticGapLine")({
              mark: rankMark(gap.place - 1),
              place: gap.place,
              need: money(gap.need, lang),
            })
          )
          .join("\n") +
        "\n";

  setDraft(ctx.from.id, { mode: "topup", step: "amount", adId: ad.id });
  await ctx.reply(
    t(lang, "forStatisticTopUpAsk")({
      name: escapeHtml(ad.name),
      money: money(ad.amountSom, lang),
      place,
      gapsBlock,
      minMoney: money(AD_MIN_SOM, lang),
    }),
    { parse_mode: "HTML" }
  );
}

// --- the paywall -----------------------------------------------------------------------

async function sendPaywall(ctx, lang, { adId, amountSom, name, about, link }) {
  const payment = await buildPaymentOptions(ctx.from.id, {
    type: "adboard",
    targetId: adId,
    amountSom,
    lang,
    t,
  });

  const summary = t(lang, "forStatisticDraftReady")({
    name: escapeHtml(name),
    about: escapeHtml(about),
    link: escapeHtml(link),
    money: money(amountSom, lang),
  });

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

// --- moderation ---------------------------------------------------------------------------
//
// Every ad is a picture and a link chosen by a member of the public and shown
// to every user. Payment is friction, not vetting, so there has to be a way to
// take one down. Admin-only, and invisible rather than refused: a refusal is
// itself a confirmation that the command exists.
const ADS_ADMIN_LIMIT = 20;
const ADS_COMMAND = "/afishalar";

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
      `${contactIcon(ad.link)} ${escapeHtml(ad.link)}\n` +
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

// An ad edited after it was approved is new content nobody has looked at, so
// it is reported exactly like a new one. Without this, "pay with something
// harmless, then edit it into a scam" is free.
function alertAboutAd(ad, { edited = false } = {}) {
  alert(
    `📊 ForStatistic: ${edited ? "afisha TAHRIRLANDI" : "yangi afisha"} #${ad.id}\n` +
      `👤 ${ad.userId}\n` +
      `📌 ${ad.name}\n` +
      `${contactIcon(ad.link)} ${ad.link}\n` +
      `💬 ${ad.about}\n` +
      `💰 ${Number(ad.amountSom).toLocaleString("uz-UZ")} so'm\n\n` +
      `Yashirish: /adhide_${ad.id}`,
    { bypassThrottle: true }
  ).catch(() => {});
}

// --- the wizard ---------------------------------------------------------------------------

const STEP = { NAME: "name", PHOTO: "photo", LINK: "link", ABOUT: "about", AMOUNT: "amount" };

async function startWizard(ctx, lang) {
  setDraft(ctx.from.id, { mode: "create", step: STEP.NAME });
  await ctx.reply(t(lang, "forStatisticAskName"), { parse_mode: "HTML" });
}

// Applies one answer to whichever field the draft is collecting, in either
// mode. Returns the next step for a create, or null when an edit is done.
async function applyEdit(ctx, lang, draft, patch) {
  const ad = await updateAd(draft.adId, patch);
  clearDraft(ctx.from.id);
  await ctx.reply(t(lang, "forStatisticEditSaved"), { parse_mode: "HTML" });
  if (ad) alertAboutAd(ad, { edited: true });
  await showMyAd(ctx, lang);
}

function registerForStatisticHandlers(bot) {
  const menuLabels = Object.values(STRINGS).map((dict) => dict.menu.forStatistic);
  const backLabels = new Set(Object.values(STRINGS).map((dict) => dict.backButton));
  const label = (key) => Object.values(STRINGS).map((dict) => dict[key]);

  // --- text, before every bot.hears -------------------------------------------
  //
  // Registered from index.js ahead of the menu handlers, so somebody partway
  // through the wizard has their message taken as the answer to the step they
  // are on rather than matched against a label that happens to appear in it.
  bot.on("text", async (ctx, next) => {
    const draft = getDraft(ctx.from.id);
    if (!draft) return next();

    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const text = ctx.message.text.trim();

    // Tapping any button -- a main-menu one or one of this screen's own --
    // means "I changed my mind, take me there", never "file this label as my
    // answer". The draft is dropped and the update carries on to whichever
    // handler owns that button.
    if (MENU_LABELS.has(text) || FS_BUTTON_LABELS.has(text)) {
      clearDraft(ctx.from.id);
      return next();
    }

    if (draft.step === STEP.NAME) {
      if (text.length < 2 || text.length > NAME_MAX) {
        await ctx.reply(t(lang, "forStatisticErrName"));
        return;
      }
      if (draft.mode === "edit") return applyEdit(ctx, lang, draft, { name: text });
      setDraft(ctx.from.id, { step: STEP.PHOTO, name: text });
      await ctx.reply(t(lang, "forStatisticAskPhoto"), { parse_mode: "HTML" });
      return;
    }

    if (draft.step === STEP.PHOTO) {
      await ctx.reply(t(lang, "forStatisticErrPhoto"), { parse_mode: "HTML" });
      return;
    }

    if (draft.step === STEP.LINK) {
      const contact = normaliseContact(text);
      if (!contact) {
        await ctx.reply(t(lang, "forStatisticErrLink"), { parse_mode: "HTML" });
        return;
      }
      if (draft.mode === "edit") return applyEdit(ctx, lang, draft, { link: contact.value });
      setDraft(ctx.from.id, { step: STEP.ABOUT, link: contact.value });
      await ctx.reply(t(lang, "forStatisticAskAbout"), { parse_mode: "HTML" });
      return;
    }

    if (draft.step === STEP.ABOUT) {
      if (text.length < 5 || text.length > ABOUT_MAX) {
        await ctx.reply(t(lang, "forStatisticErrAbout"));
        return;
      }
      if (draft.mode === "edit") return applyEdit(ctx, lang, draft, { about: text });
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

      // Topping up an ad that already exists, versus paying for a new one.
      if (draft.mode === "topup") {
        const ad = await getAd(draft.adId);
        clearDraft(ctx.from.id);
        if (!ad) {
          await showMyAd(ctx, lang);
          return;
        }
        await sendPaywall(ctx, lang, {
          adId: ad.id,
          amountSom: amount,
          name: ad.name,
          about: ad.about,
          link: ad.link,
        });
        return;
      }

      const adId = await createAd({
        userId: ctx.from.id,
        name: draft.name,
        about: draft.about,
        link: draft.link,
        mediaFileId: draft.mediaFileId,
      });
      const saved = { ...draft };
      clearDraft(ctx.from.id);
      await sendPaywall(ctx, lang, {
        adId,
        amountSom: amount,
        name: saved.name,
        about: saved.about,
        link: saved.link,
      });
      return;
    }

    return next();
  });

  bot.on("photo", async (ctx, next) => {
    const draft = getDraft(ctx.from.id);
    if (!draft || draft.step !== STEP.PHOTO) return next();

    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    if (draft.mode === "edit") return applyEdit(ctx, lang, draft, { mediaFileId: fileId });

    setDraft(ctx.from.id, { step: STEP.LINK, mediaFileId: fileId });
    await ctx.reply(t(lang, "forStatisticAskLink"), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  });

  // --- getting in and out --------------------------------------------------------

  bot.hears(menuLabels, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await showBoard(ctx, lang, 1);
  });

  bot.action("fs:open", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await showBoard(ctx, lang, 1);
  });

  // Back means one step out, not all the way home: out of the edit menu to
  // your ad, out of your ad to the board, out of the board to the main menu.
  // Falls through for anybody who is not inside ForStatistic at all, so the
  // same button keeps working everywhere else it is used.
  bot.hears([...backLabels], async (ctx, next) => {
    const screen = getScreen(ctx.from.id);
    if (!screen) return next();

    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    clearDraft(ctx.from.id);

    if (screen.screen === "edit") {
      setScreen(ctx.from.id, { screen: "myad" });
      await showMyAd(ctx, lang);
      return;
    }
    if (screen.screen === "myad") {
      await showBoard(ctx, lang, 1);
      return;
    }
    clearScreen(ctx.from.id);
    await ctx.reply(t(lang, "mainMenuIntro"), mainMenuKeyboard(lang));
  });

  bot.action(/^fs:page:(\d+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await showBoard(ctx, lang, Number(ctx.match[1]));
  });

  bot.hears(label("forStatisticInfoButton"), async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await ctx.reply(t(lang, "forStatisticInfo"), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...boardKeyboard(lang),
    });
  });

  bot.action("fs:info", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    setScreen(ctx.from.id, { screen: "board" });
    await ctx.reply(t(lang, "forStatisticInfo"), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...boardKeyboard(lang),
    });
  });

  bot.hears(label("forStatisticAddButton"), async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await startWizard(ctx, lang);
  });

  bot.action("fs:add", async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    await startWizard(ctx, lang);
  });

  // --- my ad ---------------------------------------------------------------------

  bot.hears(label("forStatisticMyAdButton"), async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await showMyAd(ctx, lang);
  });

  bot.action(/^fs:pick:(\d+)$/, async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await safeAnswerCbQuery(ctx);
    const ad = await getAd(ctx.match[1]);
    // Only over your own ad: the id travels in callback_data, which a
    // technically capable client can set to anything.
    if (!ad || String(ad.userId) !== String(ctx.from.id)) return;
    setScreen(ctx.from.id, { screen: "myad", adId: ad.id });
    await ctx.reply(t(lang, "forStatisticAdSelected")(escapeHtml(ad.name)), {
      parse_mode: "HTML",
      ...myAdKeyboard(lang),
    });
  });

  bot.hears(label("forStatisticTopUpButton"), async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    await askTopUp(ctx, lang);
  });

  bot.hears(label("forStatisticEditButton"), async (ctx) => {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const { ad } = await selectedAdFor(ctx.from.id);
    if (!ad) {
      await showMyAd(ctx, lang);
      return;
    }
    setScreen(ctx.from.id, { screen: "edit", adId: ad.id });
    await ctx.reply(t(lang, "forStatisticEditPick"), { parse_mode: "HTML", ...editKeyboard(lang) });
  });

  // One prompt per field. The draft carries mode:"edit", so the text handler
  // above saves the answer instead of walking on to the next wizard step --
  // one collection path, two ways of finishing it.
  const editField = (buttonKey, step, promptKey) =>
    bot.hears(label(buttonKey), async (ctx) => {
      const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
      const { ad } = await selectedAdFor(ctx.from.id);
      if (!ad) {
        await showMyAd(ctx, lang);
        return;
      }
      setDraft(ctx.from.id, { mode: "edit", step, adId: ad.id });
      await ctx.reply(t(lang, promptKey), { parse_mode: "HTML", disable_web_page_preview: true });
    });

  editField("forStatisticEditNameButton", STEP.NAME, "forStatisticAskName");
  editField("forStatisticEditPhotoButton", STEP.PHOTO, "forStatisticAskPhoto");
  editField("forStatisticEditLinkButton", STEP.LINK, "forStatisticAskLink");
  editField("forStatisticEditAboutButton", STEP.ABOUT, "forStatisticAskAbout");

  // --- moderation, admin only -------------------------------------------------
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
    const ad = await getAd(ctx.match[1]);

    // A hidden ad is answered exactly like one that never existed: an ad
    // taken off the board by a moderator must not stay reachable by id.
    if (!ad || !ad.active || ad.amountSom <= 0) {
      await ctx.reply(t(lang, "forStatisticAdGone"));
      return;
    }

    const board = await listTopAds(BOARD_LIMIT);
    const index = board.findIndex((row) => String(row.id) === String(ad.id));
    await sendAdCard(ctx, ad, index === -1 ? board.length + 1 : index + 1, lang);
  });
}

module.exports = {
  registerForStatisticHandlers,
  sendPromo,
  showBoard,
  BOARD_LIMIT,
  PAGE_SIZE,
  __test: {
    renderRest,
    normaliseContact,
    contactKind,
    contactUrl,
    contactIcon,
    gapsFor,
    parseAmount,
    rankMark,
    money,
    drafts,
    screens,
    sweepState,
    TTL_MS,
    escapeHtml,
    formatAdList,
    entryFields,
    ADS_COMMAND,
    ADS_ADMIN_LIMIT,
    TOP_CARDS,
    NAME_MAX,
    ABOUT_MAX,
  },
};
