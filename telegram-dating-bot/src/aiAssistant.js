// Admin-facing "ask a question, get a report" assistant. This calls the real
// Claude API, but only ever hands it numbers this process already computed --
// it never lets the model invent statistics. The model's only job is turning
// a data snapshot into a readable Uzbek report for whatever the admin asked.
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

// Cheapest current model: this is short data-formatting work, not reasoning,
// so there is no reason to pay Sonnet/Opus rates for it.
const MODEL = "claude-haiku-4-5";

function isConfigured() {
  return Boolean(client);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Everything the assistant is allowed to talk about, computed fresh from the
// database for every question. Kept to what the admin panel itself already
// shows (Statistika / Sotuvlar / Shikoyatlar) plus a last-30-days cut of the
// same numbers, so "oxirgi oy hisobot" has something to compare against.
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

const SYSTEM_PROMPT =
  "Sen ForOne tanishuv botining ichki admin panelidagi AI yordamchisiz. " +
  "Senga JSON ko'rinishida botning haqiqiy statistikasi beriladi (foydalanuvchilar, ro'yxatdan o'tishlar, sotuvlar, shikoyatlar). " +
  "Faqat shu JSON'dagi raqamlardan foydalan -- hech qachon raqam o'ylab topma yoki taxmin qilma. " +
  "Agar admin so'ragan narsa JSON'da yo'q bo'lsa, aniq ayt: 'bu ma'lumot hozircha mavjud emas' va o'rniga qaysi ma'lumotlar borligini ayt. " +
  "Javobni har doim o'zbek tilida, admin panel uslubida (emoji va qisqa sarlavhalar bilan, masalan 📊 👥 💰 🚨), lo'nda va tushunarli qilib yoz. " +
  "Foydasiz kirish so'zlarsiz, to'g'ridan-to'g'ri hisobotdan boshla.";

async function askAdminAssistant(question) {
  if (!client) throw new Error("ANTHROPIC_API_KEY sozlanmagan");

  const snapshot = await buildDataSnapshot();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Bot statistikasi (JSON):\n${JSON.stringify(snapshot, null, 2)}\n\n` +
          `Admin savoli: ${question}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "Javob olinmadi.";
}

module.exports = { isConfigured, askAdminAssistant, __test: { buildDataSnapshot } };
