const DEFAULT_LANG = "uz";

const LANGUAGES = {
  uz: { flag: "🇺🇿", label: "O'zbekcha" },
  ru: { flag: "🇷🇺", label: "Русский" },
  en: { flag: "🇬🇧", label: "English" },
};

const STRINGS = {
  uz: {
    welcomeBack: (name) => `Xush kelibsiz qaytganingizdan xursandmiz, ${name}!`,
    welcomeNew:
      "Assalomu alaykum! 👋 Tanishish va uylanish maqsadidagi botimizga xush kelibsiz.\n" +
      "Avval qisqacha anketangizni to'ldiramiz.",
    askName: "👤 Ismingizni kiriting:",
    errName: "Iltimos, to'g'ri ism kiriting (2-50 belgi):",
    askAge: "🎂 Yoshingizni kiriting (faqat raqam):",
    errAge: (min, max) => `Yoshingiz ${min} dan ${max} gacha bo'lgan butun son bo'lishi kerak. Qayta kiriting:`,
    askGender: "⚧ Jinsingizni tanlang:",
    genderMale: "👨 Erkak",
    genderFemale: "👩 Ayol",
    genderMaleValue: "Erkak",
    genderFemaleValue: "Ayol",
    errGenderButtons: "Iltimos, yuqoridagi tugmalardan birini tanlang.",
    askMedia:
      "📸 Rasm yoki video yuboring\n\n" +
      "Iltimos, tiniq va sifatli o'zingiz tushgan rasm yuboring, aks holda anketangiz o'chirib yuborilishi mumkin.",
    errMedia: "Iltimos, rasm yoki video yuboring:",
    askLocation: "📍 Manzilingizni kiriting (shahar/tuman) yoki pastdagi tugma orqali joylashuvingizni yuboring:",
    locationButton: "📍 Lokatsiya yuborish",
    errLocation: "Iltimos, manzilingizni matn shaklida kiriting yoki joylashuvingizni yuboring:",
    askBio: "📝 O'zingiz haqingizda qisqacha ma'lumot yozing (maks. 500 belgi):",
    errBio: "Iltimos, 500 belgidan oshmagan matn kiriting:",
    askContact: "✅ Anketani tasdiqlash uchun telefon raqamingizni ulashing (soxta anketalarning oldini olish uchun kerak):",
    contactButton: "📱 Raqamni yuborish",
    errContact: 'Iltimos, pastdagi "📱 Raqamni yuborish" tugmasini bosib, raqamingizni yuboring:',
    errContactOwn: "Iltimos, o'zingizning raqamingizni ulashing:",
    backButton: "⬅️ Orqaga",
    errFirstStep: "Bu birinchi qadam, orqaga qaytarib bo'lmaydi.",
    profileSaved: (p) =>
      `✅ Anketangiz saqlandi!\n\n` +
      `👤 Ism: ${p.name}\n` +
      `🎂 Yosh: ${p.age}\n` +
      `⚧ Jins: ${p.genderLabel}\n` +
      `📍 Manzil: ${p.location}\n` +
      `📝 Ma'lumot: ${p.bio}\n` +
      `📞 Tasdiqlangan raqam: ${p.phone}`,
    menu: {
      discover: "🔍 Yangi tanishuvlar",
      profile: "⚙️ Anketa sozlamalari",
      likes: "💌 Kimlar yoqtirdi",
      vip: "👑 VIP suhbat",
      premium: "💎 Premium",
    },
    menuPlaceholders: {
      vip: "👑 Chat bo'limi ustida qattiq ish olib borilmoqda. Tez orada yangilik bo'ladi! 🚧🔥",
    },
    discoverNoCandidates: "Hozircha mos nomzodlar topilmadi. Keyinroq qayta urinib ko'ring.",
    unlockLinkText: "🔐 Kandidatning shaxsiy chatiga kirish huquqini sotib olish",
    unlockPlaceholder: "🔐 Shaxsiy chatni ochish (to'lov) funksiyasi tez orada qo'shiladi.",
    unlockButton: "💳 Sotib olish",
    noLikesYet: "😔 Hozircha sizni hech kim layk bosmagan.\nTez orada ko'payadi! 🚀✨",
    likesIntro: (count) => `💌 Sizni ${count} kishi layk bosdi! 😍`,
    premiumDetails:
      "💎 Premium obuna — 1 oy\n\n" +
      "✅ Har bir nomzodning shaxsiy chatiga cheksiz kirish huquqi (🔐 alohida to'lovsiz)\n" +
      "✅ Profilingiz boshqa foydalanuvchilarga ko'proq va tez-tez ko'rsatiladi\n\n" +
      "💵 Narxi: 69 000 so'm / 1 oy",
    premiumPayButton: "💳 Payme orqali to'lash",
    premiumPayPlaceholder: "💳 To'lov tizimi hozircha ulanmagan. Tez orada ishga tushadi!",
    premiumPayClickButton: "💳 Click orqali to'lash",
    premiumPayClickNotConfigured: "💳 Click to'lovi hali to'liq sozlanmagan (Merchant ID / Service ID kutilmoqda).",
    premiumActivated: (days) => `🎉 Premium faollashtirildi! ${days} kun davomida barcha imtiyozlardan foydalanasiz.`,
    profileSettingsIntro: "⚙️ Anketa sozlamalari:",
    profileSettingsEdit: "✏️ Anketani tahrirlash",
    profileSettingsView: "👁 Mening anketam",
    profileSettingsDeactivate: "🔴 Anketani faolsizlantirish",
    profileSettingsActivate: "🟢 Anketani faollantirish",
    profileDeactivated: "✅ Anketangiz faolsizlantirildi. Endi boshqalarga ko'rinmaysiz.",
    profileActivated: "✅ Anketangiz faollashtirildi. Endi boshqalarga ko'rinasiz.",
    profileStatusActive: "🟢 Faol",
    profileStatusInactive: "🔴 Faolsiz",
    noProfileYet: "Sizda hali anketa yo'q. Avval /start orqali anketa to'ldiring.",
  },
  ru: {
    welcomeBack: (name) => `Рады видеть вас снова, ${name}!`,
    welcomeNew: "Здравствуйте! 👋 Добро пожаловать в бот знакомств.\nСначала заполним вашу анкету.",
    askName: "👤 Введите ваше имя:",
    errName: "Пожалуйста, введите корректное имя (2-50 символов):",
    askAge: "🎂 Введите ваш возраст (только число):",
    errAge: (min, max) => `Возраст должен быть целым числом от ${min} до ${max}. Введите заново:`,
    askGender: "⚧ Выберите ваш пол:",
    genderMale: "👨 Мужчина",
    genderFemale: "👩 Женщина",
    genderMaleValue: "Мужчина",
    genderFemaleValue: "Женщина",
    errGenderButtons: "Пожалуйста, выберите один из вариантов выше.",
    askMedia:
      "📸 Отправьте фото или видео\n\n" +
      "Пожалуйста, отправьте чёткое и качественное фото с собой, иначе анкета может быть удалена.",
    errMedia: "Пожалуйста, отправьте фото или видео:",
    askLocation: "📍 Введите ваш адрес (город/район) или отправьте геолокацию через кнопку ниже:",
    locationButton: "📍 Отправить геолокацию",
    errLocation: "Пожалуйста, введите адрес текстом или отправьте геолокацию:",
    askBio: "📝 Напишите немного о себе (макс. 500 символов):",
    errBio: "Пожалуйста, введите текст не более 500 символов:",
    askContact: "✅ Для подтверждения анкеты поделитесь номером телефона (это защита от фейковых анкет):",
    contactButton: "📱 Отправить номер",
    errContact: 'Пожалуйста, нажмите кнопку "📱 Отправить номер" ниже:',
    errContactOwn: "Пожалуйста, поделитесь своим собственным номером:",
    backButton: "⬅️ Назад",
    errFirstStep: "Это первый шаг, назад пути нет.",
    profileSaved: (p) =>
      `✅ Ваша анкета сохранена!\n\n` +
      `👤 Имя: ${p.name}\n` +
      `🎂 Возраст: ${p.age}\n` +
      `⚧ Пол: ${p.genderLabel}\n` +
      `📍 Адрес: ${p.location}\n` +
      `📝 О себе: ${p.bio}\n` +
      `📞 Подтверждённый номер: ${p.phone}`,
    menu: {
      discover: "🔍 Новые знакомства",
      profile: "⚙️ Настройки анкеты",
      likes: "💌 Кому я понравился",
      vip: "👑 VIP чат",
      premium: "💎 Премиум",
    },
    menuPlaceholders: {
      vip: "👑 Ведётся активная работа над разделом чата. Совсем скоро новости! 🚧🔥",
    },
    discoverNoCandidates: "Подходящих анкет пока не найдено. Попробуйте позже.",
    unlockLinkText: "🔐 Купить доступ к личному чату кандидата",
    noLikesYet: "😔 Пока никто не поставил вам лайк.\nСкоро их станет больше! 🚀✨",
    likesIntro: (count) => `💌 Вам поставили лайк ${count} человек! 😍`,
    unlockPlaceholder: "🔐 Функция открытия личного чата (платно) скоро появится.",
    unlockButton: "💳 Купить",
    premiumDetails:
      "💎 Премиум подписка — 1 месяц\n\n" +
      "✅ Неограниченный доступ к личному чату каждого кандидата (без отдельной оплаты 🔐)\n" +
      "✅ Ваш профиль показывается другим пользователям чаще и заметнее\n\n" +
      "💵 Цена: 69 000 сум / 1 месяц",
    premiumPayButton: "💳 Оплатить через Payme",
    premiumPayPlaceholder: "💳 Платёжная система пока не подключена. Скоро заработает!",
    premiumPayClickButton: "💳 Оплатить через Click",
    premiumPayClickNotConfigured: "💳 Оплата через Click ещё не полностью настроена (ожидаются Merchant ID / Service ID).",
    premiumActivated: (days) => `🎉 Премиум активирован! Все привилегии доступны в течение ${days} дней.`,
    profileSettingsIntro: "⚙️ Настройки анкеты:",
    profileSettingsEdit: "✏️ Редактировать анкету",
    profileSettingsView: "👁 Моя анкета",
    profileSettingsDeactivate: "🔴 Деактивировать анкету",
    profileSettingsActivate: "🟢 Активировать анкету",
    profileDeactivated: "✅ Ваша анкета деактивирована. Теперь она не видна другим.",
    profileActivated: "✅ Ваша анкета активирована. Теперь она видна другим.",
    profileStatusActive: "🟢 Активна",
    profileStatusInactive: "🔴 Неактивна",
    noProfileYet: "У вас пока нет анкеты. Сначала заполните её через /start.",
  },
  en: {
    welcomeBack: (name) => `Welcome back, ${name}!`,
    welcomeNew: "Hello! 👋 Welcome to the dating bot.\nFirst, let's fill out your profile.",
    askName: "👤 Enter your name:",
    errName: "Please enter a valid name (2-50 characters):",
    askAge: "🎂 Enter your age (numbers only):",
    errAge: (min, max) => `Your age must be a whole number between ${min} and ${max}. Try again:`,
    askGender: "⚧ Choose your gender:",
    genderMale: "👨 Male",
    genderFemale: "👩 Female",
    genderMaleValue: "Male",
    genderFemaleValue: "Female",
    errGenderButtons: "Please choose one of the buttons above.",
    askMedia:
      "📸 Send a photo or video\n\n" +
      "Please send a clear, good-quality photo of yourself, otherwise your profile may be removed.",
    errMedia: "Please send a photo or video:",
    askLocation: "📍 Enter your location (city/district) or share it using the button below:",
    locationButton: "📍 Send location",
    errLocation: "Please enter your location as text or share it:",
    askBio: "📝 Write a short bio about yourself (max 500 characters):",
    errBio: "Please enter no more than 500 characters:",
    askContact: "✅ To confirm your profile, share your phone number (this helps prevent fake profiles):",
    contactButton: "📱 Send number",
    errContact: 'Please tap the "📱 Send number" button below:',
    errContactOwn: "Please share your own phone number:",
    backButton: "⬅️ Back",
    errFirstStep: "This is the first step, there's nothing before it.",
    profileSaved: (p) =>
      `✅ Your profile has been saved!\n\n` +
      `👤 Name: ${p.name}\n` +
      `🎂 Age: ${p.age}\n` +
      `⚧ Gender: ${p.genderLabel}\n` +
      `📍 Location: ${p.location}\n` +
      `📝 Bio: ${p.bio}\n` +
      `📞 Verified number: ${p.phone}`,
    menu: {
      discover: "🔍 New matches",
      profile: "⚙️ Profile settings",
      likes: "💌 Who liked me",
      vip: "👑 VIP chat",
      premium: "💎 Premium",
    },
    menuPlaceholders: {
      vip: "👑 We're working hard on the chat feature. Big news coming soon! 🚧🔥",
    },
    discoverNoCandidates: "No matching candidates found yet. Try again later.",
    unlockLinkText: "🔐 Unlock this candidate's private chat",
    noLikesYet: "😔 No one has liked you yet.\nMore is coming soon! 🚀✨",
    likesIntro: (count) => `💌 ${count} people liked you! 😍`,
    unlockPlaceholder: "🔐 Unlocking the private chat (paid) is coming soon.",
    unlockButton: "💳 Buy",
    premiumDetails:
      "💎 Premium subscription — 1 month\n\n" +
      "✅ Unlimited access to every candidate's private chat (no separate 🔐 payments)\n" +
      "✅ Your profile is shown to other users more often and more prominently\n\n" +
      "💵 Price: 69,000 UZS / month",
    premiumPayButton: "💳 Pay with Payme",
    premiumPayPlaceholder: "💳 The payment system isn't connected yet. Coming soon!",
    premiumPayClickButton: "💳 Pay with Click",
    premiumPayClickNotConfigured: "💳 Click payments aren't fully set up yet (waiting on Merchant ID / Service ID).",
    premiumActivated: (days) => `🎉 Premium activated! You'll have all the perks for ${days} days.`,
    profileSettingsIntro: "⚙️ Profile settings:",
    profileSettingsEdit: "✏️ Edit profile",
    profileSettingsView: "👁 My profile",
    profileSettingsDeactivate: "🔴 Deactivate profile",
    profileSettingsActivate: "🟢 Activate profile",
    profileDeactivated: "✅ Your profile has been deactivated. Others can no longer see it.",
    profileActivated: "✅ Your profile has been activated. Others can see it now.",
    profileStatusActive: "🟢 Active",
    profileStatusInactive: "🔴 Inactive",
    noProfileYet: "You don't have a profile yet. Fill one out first via /start.",
  },
};

function t(lang, key) {
  const dict = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  return dict[key] ?? STRINGS[DEFAULT_LANG][key];
}

module.exports = { DEFAULT_LANG, LANGUAGES, STRINGS, t };
