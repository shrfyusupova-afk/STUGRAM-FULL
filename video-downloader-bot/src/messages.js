// Every user-facing string in one place -- the bot only ever speaks Uzbek,
// so unlike ForOne there is no per-language table here, just names for the
// messages instead of retyping them at each call site.
const { MAX_DURATION_SECONDS, MAX_UPLOAD_BYTES } = require("./downloader");

const START_TEXT =
  "👋 Salom!\n\n" +
  "Menga Instagram, TikTok yoki YouTube havolasini yuboring -- videosini shu yerga tashlab beraman.\n\n" +
  `⏳ Video uzunligi: ${Math.round(MAX_DURATION_SECONDS / 60)} daqiqagacha\n` +
  `📦 Hajmi: ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB gacha`;

const NO_LINK_TEXT =
  "🔗 Menga Instagram, TikTok yoki YouTube havolasini yuboring.";

const DOWNLOADING_TEXT = "⏳ Yuklab olinmoqda, biroz kuting...";

const REFUSAL_TEXT = {
  live: "🔴 Jonli translyatsiyalarni yuklab bo'lmaydi -- u hali tugamagan.",
  too_long: (detail) =>
    `⏱ Bu video juda uzun (${Math.round(detail.duration / 60)} daqiqa). ` +
    `Men ${Math.round(detail.limit / 60)} daqiqagacha bo'lgan videolarni yuklay olaman.`,
  too_large: (detail) =>
    `📦 Video juda katta (${(detail.bytes / 1024 / 1024).toFixed(1)} MB). ` +
    `Men ${Math.round(detail.limit / 1024 / 1024)} MB gacha yubora olaman -- bu Telegram botlar uchun umumiy chegara.`,
  unavailable:
    "🚫 Bu video mavjud emas yoki shaxsiy (yopiq) hisob videosi. Ochiq (public) postlarni yuklay olaman.",
  blocked:
    "🤖 Platforma hozir botlarni tekshiryapti va meni vaqtincha bloklab qo'ydi. " +
    "Biroz kutib, qayta urinib ko'ring -- odatda o'zi tuzaladi.",
  timeout: "⏰ Yuklab olish juda uzoq davom etdi va to'xtatildi. Qayta urinib ko'ring.",
  failed: "⚠️ Yuklab bo'lmadi. Havola to'g'riligini tekshirib, qayta urinib ko'ring.",
};

function refusalText(reasonKey, detail) {
  const entry = REFUSAL_TEXT[reasonKey] || REFUSAL_TEXT.failed;
  return typeof entry === "function" ? entry(detail) : entry;
}

module.exports = { START_TEXT, NO_LINK_TEXT, DOWNLOADING_TEXT, refusalText };
