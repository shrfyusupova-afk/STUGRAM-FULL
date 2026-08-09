// Admin-facing conversational assistant. It behaves like a normal chat
// partner on any topic, but the moment the admin asks about the bot's own
// numbers (users, sales, complaints...), it must answer only from a real,
// freshly-computed data snapshot -- never an invented statistic.
const Anthropic = require("@anthropic-ai/sdk");
const { getProfileStats, listComplaints, countNewProfilesSince } = require("./db");
const { getSalesSummary } = require("./click");

// Same pattern as ADMIN_PIN_CODE / CLICK_* below: missing config degrades the
// feature to "unavailable", not a crash, and is visible from /health.
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.warn("ANTHROPIC_API_KEY is not set -- the admin AI assistant is disabled until it is.");
}

const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

// Cheapest current model: even free-form chat here is low-volume (one admin,
// occasional questions), so there is no reason to pay Sonnet/Opus rates.
const MODEL = "claude-haiku-4-5";

// How many past turns (question+answer pairs) are kept and resent on every
// message, so the chat has memory without growing the request without bound.
const MAX_HISTORY_MESSAGES = 20;

function isConfigured() {
  return Boolean(client);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Everything the assistant can ground bot-related answers in, computed fresh
// from the database for every question -- never cached, never carried over
// from a previous turn, so it can't go stale across a long conversation.
// Kept to what the admin panel itself already shows (Statistika / Sotuvlar /
// Shikoyatlar) plus a last-30-days cut of the same numbers, so "oxirgi oy
// hisobot" has something to compare against.
async function buildDataSnapshot() {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS).toISOString();
  const since60 = new Date(now - 60 * DAY_MS).toISOString();

  const [stats, allTimeSales, last30Sales, newMale30, newFemale30, newMale30to60, newFemale30to60, complaints] =
    await Promise.all([
      getProfileStats(),
      getSalesSummary(),
      getSalesSummary(since30),
      countNewProfilesSince("male", since30),
      countNewProfilesSince("female", since30),
      countNewProfilesSince("male", since60),
      countNewProfilesSince("female", since60),
      listComplaints(),
    ]);

  // "30-60 kun oldin" ni ajratish uchun: 60 kunlik oyna ichidan so'nggi 30
  // kunlikni ayirib tashlaymiz.
  const prevMale30 = Math.max(0, newMale30to60 - newMale30);
  const prevFemale30 = Math.max(0, newFemale30to60 - newFemale30);

  const pendingComplaints = complaints.filter((c) => c.status !== "answered").length;

  return {
    generatedAt: new Date(now).toISOString(),
    profiles: stats,
    newRegistrationsLast30Days: { male: newMale30, female: newFemale30, total: newMale30 + newFemale30 },
    newRegistrationsPrior30Days: { male: prevMale30, female: prevFemale30, total: prevMale30 + prevFemale30 },
    salesAllTime: allTimeSales,
    salesLast30Days: last30Sales,
    complaints: { total: complaints.length, pending: pendingComplaints, answered: complaints.length - pendingComplaints },
  };
}

function buildSystemPrompt(snapshot) {
  return (
    "Sen ForOne tanishuv botining ichki admin panelidagi AI yordamchisiz -- adminning suhbatdoshisan. " +
    "U sendan istalgan mavzuda savol so'rashi mumkin: botning statistikasi, ish yuritish maslahati, " +
    "umumiy bilim, yoki oddiy suhbat. Bularning har biriga erkin va foydali javob ber, xuddi bilimli " +
    "hamkasb bilan suhlashayotgandek.\n\n" +
    "Faqat BITTA qat'iy qoida bor: agar savol botning o'z ma'lumotlariga oid bo'lsa (foydalanuvchilar soni, " +
    "ro'yxatdan o'tishlar, sotuvlar, shikoyatlar va h.k.), FAQAT quyidagi JSON'dagi haqiqiy raqamlardan " +
    "foydalan -- hech qachon raqam o'ylab topma yoki taxmin qilma. Agar so'ralgan narsa shu JSON'da yo'q " +
    "bo'lsa, aniq ayt: 'bu ma'lumot hozircha mavjud emas' va o'rniga qaysi ma'lumotlar borligini ayt. " +
    "Boshqa har qanday mavzuda bu cheklov yo'q.\n\n" +
    `Botning eng so'nggi statistikasi (JSON, faqat shu maqsad uchun):\n${JSON.stringify(snapshot, null, 2)}\n\n` +
    "Javobni admin so'ragan tilda (aks holda o'zbek tilida) yoz, qisqa va tushunarli qilib, ortiqcha kirish " +
    "so'zlarsiz to'g'ridan-to'g'ri mohiyatdan boshla."
  );
}

// `history` is the running [{role, content}, ...] transcript the caller
// keeps per admin. Returns the answer plus the updated history to store --
// the snapshot itself is never persisted into history (it's rebuilt fresh
// into `system` every call), so a long chat can't drag a stale one along.
async function askAdminAssistant(question, history = []) {
  if (!client) throw new Error("ANTHROPIC_API_KEY sozlanmagan");

  const snapshot = await buildDataSnapshot();
  const messages = [...history, { role: "user", content: question }];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1536,
    system: buildSystemPrompt(snapshot),
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const answer = textBlock ? textBlock.text : "Javob olinmadi.";

  const updatedHistory = [...messages, { role: "assistant", content: answer }].slice(-MAX_HISTORY_MESSAGES);
  return { answer, history: updatedHistory };
}

// Exposed directly (not just under __test) so the admin panel's plain,
// non-AI "To'liq hisobot" button can build the exact same real numbers
// without needing ANTHROPIC_API_KEY or spending any API credit at all.
module.exports = { isConfigured, askAdminAssistant, buildDataSnapshot, __test: { buildDataSnapshot } };
