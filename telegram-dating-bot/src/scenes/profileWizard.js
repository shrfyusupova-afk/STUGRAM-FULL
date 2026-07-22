const { Scenes, Markup } = require("telegraf");
const { saveProfile } = require("../db");
const { sendMainMenu } = require("../menu");

const MIN_AGE = 18;
const MAX_AGE = 90;

async function askName(ctx) {
  await ctx.reply("👤 Ismingizni kiriting:");
  return ctx.wizard.next();
}

async function onName(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text || text.length < 2 || text.length > 50) {
    await ctx.reply("Iltimos, to'g'ri ism kiriting (2-50 belgi):");
    return;
  }
  ctx.wizard.state.profile.name = text;
  await ctx.reply("🎂 Yoshingizni kiriting (faqat raqam):");
  return ctx.wizard.next();
}

async function onAge(ctx) {
  const text = ctx.message?.text?.trim();
  const age = Number(text);
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    await ctx.reply(`Yoshingiz ${MIN_AGE} dan ${MAX_AGE} gacha bo'lgan butun son bo'lishi kerak. Qayta kiriting:`);
    return;
  }
  ctx.wizard.state.profile.age = age;
  await ctx.reply(
    "⚧ Jinsingizni tanlang:",
    Markup.inlineKeyboard([
      [Markup.button.callback("🔵 Erkak", "gender:erkak"), Markup.button.callback("🔴 Ayol", "gender:ayol")],
    ])
  );
  return ctx.wizard.next();
}

async function onGender(ctx) {
  if (!ctx.callbackQuery) {
    await ctx.reply("Iltimos, yuqoridagi tugmalardan birini tanlang.");
    return;
  }
  const choice = ctx.callbackQuery.data === "gender:erkak" ? "Erkak" : "Ayol";
  ctx.wizard.state.profile.gender = choice;
  await ctx.answerCbQuery();
  await ctx.reply("📷 Rasmingizni yuboring (bitta foto):");
  return ctx.wizard.next();
}

async function onPhoto(ctx) {
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) {
    await ctx.reply("Iltimos, rasm (foto) yuboring:");
    return;
  }
  const bestPhoto = photos[photos.length - 1];
  ctx.wizard.state.profile.photoFileId = bestPhoto.file_id;
  await ctx.reply("📍 Manzilingizni kiriting (shahar/tuman):");
  return ctx.wizard.next();
}

async function onLocation(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text || text.length < 2 || text.length > 100) {
    await ctx.reply("Iltimos, manzilingizni matn shaklida kiriting:");
    return;
  }
  ctx.wizard.state.profile.location = text;
  await ctx.reply(
    "🔗 Ijtimoiy tarmoq akkauntingizni kiriting (masalan @username). O'tkazib yuborish uchun \"-\" yuboring:"
  );
  return ctx.wizard.next();
}

async function onAccount(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text) {
    await ctx.reply("Iltimos, akkaunt kiriting yoki o'tkazib yuborish uchun \"-\" yuboring:");
    return;
  }
  ctx.wizard.state.profile.account = text === "-" ? "Kiritilmagan" : text;
  await ctx.reply("📝 O'zingiz haqingizda qisqacha ma'lumot yozing (maks. 500 belgi):");
  return ctx.wizard.next();
}

const contactRequestKeyboard = Markup.keyboard([Markup.button.contactRequest("📱 Raqamni yuborish")])
  .resize()
  .oneTime();

async function onBio(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text || text.length > 500) {
    await ctx.reply("Iltimos, 500 belgidan oshmagan matn kiriting:");
    return;
  }
  ctx.wizard.state.profile.bio = text;

  await ctx.reply(
    "✅ Anketani tasdiqlash uchun telefon raqamingizni ulashing (soxta anketalarning oldini olish uchun kerak):",
    contactRequestKeyboard
  );
  return ctx.wizard.next();
}

// Phone confirmation doubles as a lightweight anti-fake-profile check: a
// shared contact card is tied to a real Telegram account, unlike free text.
async function onContact(ctx) {
  const contact = ctx.message?.contact;
  if (!contact?.phone_number) {
    await ctx.reply(
      'Iltimos, pastdagi "📱 Raqamni yuborish" tugmasini bosib, raqamingizni yuboring:',
      contactRequestKeyboard
    );
    return;
  }
  if (contact.user_id && contact.user_id !== ctx.from.id) {
    await ctx.reply("Iltimos, o'zingizning raqamingizni ulashing:", contactRequestKeyboard);
    return;
  }

  ctx.wizard.state.profile.phone = contact.phone_number;

  const profile = ctx.wizard.state.profile;
  saveProfile(ctx.from.id, profile);

  await sendMainMenu(ctx, profile);
  return ctx.scene.leave();
}

const profileWizard = new Scenes.WizardScene(
  "profile-wizard",
  async (ctx) => {
    ctx.wizard.state.profile = {};
    return askName(ctx);
  },
  onName,
  onAge,
  onGender,
  onPhoto,
  onLocation,
  onAccount,
  onBio,
  onContact
);

module.exports = { profileWizard };
