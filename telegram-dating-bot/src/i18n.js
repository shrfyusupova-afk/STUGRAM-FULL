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
    askBio: "📝 O'zingiz haqingizda qisqacha ma'lumot yozing (maks. 80 belgi):",
    errBio: "Iltimos, 80 belgidan oshmagan matn kiriting:",
    askContact: "✅ Anketani tasdiqlash uchun telefon raqamingizni ulashing (soxta anketalarning oldini olish uchun kerak):",
    contactButton: "📱 Raqamni yuborish",
    errContact: 'Iltimos, pastdagi "📱 Raqamni yuborish" tugmasini bosib, raqamingizni yuboring:',
    errContactOwn: "Iltimos, o'zingizning raqamingizni ulashing:",
    backButton: "⬅️ Orqaga",
    errFirstStep: "Bu birinchi qadam, orqaga qaytarib bo'lmaydi.",
    confirmIntro: (linkHtml) =>
      `✅ Ma'lumotlaringizni tasdiqlaysizmi?\n\n` +
      `"Ha" tugmasini bosish orqali kiritilgan ma'lumotlar to'g'riligini tasdiqlaysiz hamda ${linkHtml} rozilik bildirasiz.\n\n` +
      `Hammasi to'g'rimi?`,
    confirmYesButton: "✅ Ha",
    confirmError: 'Iltimos, pastdagi "✅ Ha" tugmasini bosing.',
    policyLinkText: "Maxfiylik siyosati va Foydalanuvchi kelishuviga",
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
    vipIntro:
      "👑 VIP Chat — bu yerda sizni nimalar kutmoqda?\n\n" +
      "🎉 Yangi do'stlar orttirasiz\n" +
      "🎲 Mafiya o'yinini o'ynab, ajoyib hordiq chiqarasiz\n" +
      "💃 Kundan-kunga ko'payib borayotgan qizlar bilan tanishasiz\n" +
      "💍 Omadingiz kelsa — hayotingizning yarim bo'lagini shu yerda topishingiz mumkin!\n\n" +
      "⏳ Hoziroq ulgurib qoling — qizlar ko'paygani sari, kirish narxi ham oshib boradi!\n\n" +
      "💵 Narxi:\n" +
      "👦 Yigitlar uchun — 59 900 so'm\n" +
      "👧 Qizlar uchun — 🆓 Mutlaqo bepul\n\n" +
      "😉 Va'da beraman — bu yerda zerikishga vaqtingiz bo'lmaydi!",
    vipPayButton: "💳 To'lov qilmoqchiman",
    vipJoinFreeButton: "🔗 Bepul qo'shilish",
    vipChoosePaymentIntro: "💳 To'lov usulini tanlang:",
    vipClickButton: "💳 Click orqali to'lash",
    vipPaymeButton: "💳 Payme orqali to'lash",
    vipClickNotConfigured: "💳 Click to'lovi hali to'liq sozlanmagan. Tez orada ishga tushadi! 🚧",
    vipPaymeNotConfigured: "💳 Payme to'lovi hali ulanmagan. Tez orada qo'shiladi! 🚧",
    vipJoinMessage: (link) => `🎉 Xush kelibsiz! Guruhga qo'shilish uchun havola:\n${link}`,
    discoverNoCandidates: "Hozircha mos nomzodlar topilmadi. Keyinroq qayta urinib ko'ring.",
    unlockLinkText: (price) => `🔐 Profilni to'liq ko'rish (${price} so'm)`,
    unlockPaywallIntro:
      "🔐 Bu profilni to'liq ko'rish uchun to'lov talab qilinadi\n\n" +
      "💳 Narxi: 7 900 so'm — har bir profil uchun alohida\n" +
      "🆓 (Agar tekin yo'ldan foydalanmoqchi bo'lsangiz, u insonning ham sizga layk bosishini kuting 😉)\n\n" +
      "💎 Agar barcha nomzodlarning profilini cheklovsiz ko'rmoqchi bo'lsangiz, Premium tarifga ulanishni tavsiya qilamiz! ✨",
    unlockPayButton: "🔓 Profil egasini ko'rish — 7 900 so'm",
    unlockPremiumButton: "👑 Premium'ga ulanish",
    unlockNotConfigured: "🔐 To'lov tizimi hali to'liq sozlanmagan. Tez orada ishga tushadi! 🚧",
    viewProfileButton: "👁 Profilni ko'rish",
    unlockPaymentSuccessIntro: "🎉 To'lov muvaffaqiyatli o'tdi!\n\n👁 Profilni ko'rish uchun pastdagi tugmani bosing:",
    matchedToast: "🎉 Mos tushdingiz! Endi profilni bepul ko'rishingiz mumkin.",
    matchNotification: (name) => `🎉 Siz ${name} bilan mos tushdingiz! Profilni bepul ko'rishingiz mumkin.`,
    unlockSuccessNoContact: "✅ To'lov qabul qilindi, ammo bu anketa afsuski allaqachon o'chirilgan. 😔",
    noLikesYet: "😔 Hozircha sizni hech kim layk bosmagan.\nTez orada ko'payadi! 🚀✨",
    likesIntro: (count) => `💌 Sizni ${count} kishi layk bosdi! 😍`,
    premiumDetails:
      "💎 Premium obuna — 1 oy\n\n" +
      "✅ Har bir nomzodning shaxsiy chatiga cheksiz kirish huquqi (🔐 alohida to'lovsiz)\n" +
      "✅ Profilingiz boshqa foydalanuvchilarga ko'proq va tez-tez ko'rsatiladi\n\n" +
      "💵 Narxi: 69 000 so'm / 1 oy",
    premiumPayClickButton: "💳 Click orqali to'lash",
    premiumPayClickNotConfigured: "💳 Click to'lovi hali to'liq sozlanmagan (Merchant ID / Service ID kutilmoqda).",
    premiumQrCaption: "📷 Yoki shu QR kodni skanerlab to'lang",
    premiumActivated: (days) => `🎉 Premium faollashtirildi! ${days} kun davomida barcha imtiyozlardan foydalanasiz.`,
    profileSettingsIntro: "⚙️ Anketa sozlamalari:",
    profileSettingsEdit: "✏️ Anketani tahrirlash",
    profileSettingsView: "👁 Mening anketam",
    profileSettingsDeactivate: "🔴 Anketani faolsizlantirish",
    profileSettingsActivate: "🟢 Anketani faollantirish",
    profileDeactivated: "✅ Anketangiz faolsizlantirildi. Endi boshqalarga ko'rinmaysiz.",
    profileActivated: "✅ Anketangiz faollashtirildi. Endi boshqalarga ko'rinasiz.",
    bioLabel: "📝 O'zi haqida:",
    profileStatusActive: "🟢 Faol",
    profileStatusInactive: "🔴 Faolsiz",
    profilePremiumActive: (date) => `💎 Premium: faol (${date} gacha)`,
    profilePremiumNone: "💎 Premium: yo'q",
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
    askBio: "📝 Напишите немного о себе (макс. 80 символов):",
    errBio: "Пожалуйста, введите текст не более 80 символов:",
    askContact: "✅ Для подтверждения анкеты поделитесь номером телефона (это защита от фейковых анкет):",
    contactButton: "📱 Отправить номер",
    errContact: 'Пожалуйста, нажмите кнопку "📱 Отправить номер" ниже:',
    errContactOwn: "Пожалуйста, поделитесь своим собственным номером:",
    backButton: "⬅️ Назад",
    errFirstStep: "Это первый шаг, назад пути нет.",
    confirmIntro: (linkHtml) =>
      `✅ Вы подтверждаете свои данные?\n\n` +
      `Нажимая "Да", вы подтверждаете достоверность введённых данных и соглашаетесь с ${linkHtml}.\n\n` +
      `Всё верно?`,
    confirmYesButton: "✅ Да",
    confirmError: 'Пожалуйста, нажмите кнопку "✅ Да" ниже.',
    policyLinkText: "Политикой конфиденциальности и Пользовательским соглашением",
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
    vipIntro:
      "👑 VIP Chat — что вас здесь ждёт?\n\n" +
      "🎉 Заведёте новых друзей\n" +
      "🎲 Сыграете в Мафию и отлично отдохнёте\n" +
      "💃 Познакомитесь с девушками, которых с каждым днём становится всё больше\n" +
      "💍 Если повезёт — найдёте свою вторую половинку прямо здесь!\n\n" +
      "⏳ Успейте сейчас — чем больше девушек, тем выше становится цена входа!\n\n" +
      "💵 Цена:\n" +
      "👦 Для парней — 59 900 сум\n" +
      "👧 Для девушек — 🆓 Совершенно бесплатно\n\n" +
      "😉 Обещаю — скучать здесь не придётся!",
    vipPayButton: "💳 Хочу оплатить",
    vipJoinFreeButton: "🔗 Присоединиться бесплатно",
    vipChoosePaymentIntro: "💳 Выберите способ оплаты:",
    vipClickButton: "💳 Оплатить через Click",
    vipPaymeButton: "💳 Оплатить через Payme",
    vipClickNotConfigured: "💳 Оплата через Click ещё не полностью настроена. Скоро заработает! 🚧",
    vipPaymeNotConfigured: "💳 Оплата через Payme ещё не подключена. Скоро появится! 🚧",
    vipJoinMessage: (link) => `🎉 Добро пожаловать! Ссылка для вступления в группу:\n${link}`,
    discoverNoCandidates: "Подходящих анкет пока не найдено. Попробуйте позже.",
    unlockLinkText: (price) => `🔐 Посмотреть анкету полностью (${price} сум)`,
    unlockPaywallIntro:
      "🔐 Чтобы посмотреть эту анкету полностью, требуется оплата\n\n" +
      "💳 Цена: 7 900 сум — за каждую анкету отдельно\n" +
      "🆓 (Если хотите бесплатно, дождитесь, пока этот человек тоже поставит вам лайк 😉)\n\n" +
      "💎 Если хотите смотреть анкеты всех кандидатов без ограничений, рекомендуем подключить Premium! ✨",
    unlockPayButton: "🔓 Посмотреть анкету — 7 900 сум",
    unlockPremiumButton: "👑 Подключить Premium",
    unlockNotConfigured: "🔐 Оплата пока не полностью настроена. Скоро заработает! 🚧",
    viewProfileButton: "👁 Посмотреть анкету",
    unlockPaymentSuccessIntro: "🎉 Оплата прошла успешно!\n\n👁 Нажмите кнопку ниже, чтобы посмотреть анкету:",
    matchedToast: "🎉 Это совпадение! Теперь вы можете бесплатно посмотреть анкету.",
    matchNotification: (name) => `🎉 У вас взаимная симпатия с ${name}! Теперь вы можете бесплатно посмотреть анкету.`,
    unlockSuccessNoContact: "✅ Оплата получена, но, к сожалению, эта анкета уже удалена. 😔",
    noLikesYet: "😔 Пока никто не поставил вам лайк.\nСкоро их станет больше! 🚀✨",
    likesIntro: (count) => `💌 Вам поставили лайк ${count} человек! 😍`,
    premiumDetails:
      "💎 Премиум подписка — 1 месяц\n\n" +
      "✅ Неограниченный доступ к личному чату каждого кандидата (без отдельной оплаты 🔐)\n" +
      "✅ Ваш профиль показывается другим пользователям чаще и заметнее\n\n" +
      "💵 Цена: 69 000 сум / 1 месяц",
    premiumPayClickButton: "💳 Оплатить через Click",
    premiumPayClickNotConfigured: "💳 Оплата через Click ещё не полностью настроена (ожидаются Merchant ID / Service ID).",
    premiumQrCaption: "📷 Или отсканируйте этот QR-код для оплаты",
    premiumActivated: (days) => `🎉 Премиум активирован! Все привилегии доступны в течение ${days} дней.`,
    profileSettingsIntro: "⚙️ Настройки анкеты:",
    profileSettingsEdit: "✏️ Редактировать анкету",
    profileSettingsView: "👁 Моя анкета",
    profileSettingsDeactivate: "🔴 Деактивировать анкету",
    profileSettingsActivate: "🟢 Активировать анкету",
    profileDeactivated: "✅ Ваша анкета деактивирована. Теперь она не видна другим.",
    profileActivated: "✅ Ваша анкета активирована. Теперь она видна другим.",
    bioLabel: "📝 О себе:",
    profileStatusActive: "🟢 Активна",
    profileStatusInactive: "🔴 Неактивна",
    profilePremiumActive: (date) => `💎 Премиум: активен (до ${date})`,
    profilePremiumNone: "💎 Премиум: нет",
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
    askBio: "📝 Write a short bio about yourself (max 80 characters):",
    errBio: "Please enter no more than 80 characters:",
    askContact: "✅ To confirm your profile, share your phone number (this helps prevent fake profiles):",
    contactButton: "📱 Send number",
    errContact: 'Please tap the "📱 Send number" button below:',
    errContactOwn: "Please share your own phone number:",
    backButton: "⬅️ Back",
    errFirstStep: "This is the first step, there's nothing before it.",
    confirmIntro: (linkHtml) =>
      `✅ Do you confirm your details?\n\n` +
      `By tapping "Yes", you confirm that the information you entered is accurate and agree to the ${linkHtml}.\n\n` +
      `Is everything correct?`,
    confirmYesButton: "✅ Yes",
    confirmError: 'Please tap the "✅ Yes" button below.',
    policyLinkText: "Privacy Policy and User Agreement",
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
    vipIntro:
      "👑 VIP Chat — what's waiting for you here?\n\n" +
      "🎉 Make new friends\n" +
      "🎲 Play Mafia and have a great time\n" +
      "💃 Meet girls — and there are more of them every day\n" +
      "💍 If you're lucky, you might just find your other half right here!\n\n" +
      "⏳ Join now — the price goes up as more girls join!\n\n" +
      "💵 Price:\n" +
      "👦 For guys — 59,900 UZS\n" +
      "👧 For girls — 🆓 Completely free\n\n" +
      "😉 I promise — you won't be bored here!",
    vipPayButton: "💳 I want to pay",
    vipJoinFreeButton: "🔗 Join for free",
    vipChoosePaymentIntro: "💳 Choose a payment method:",
    vipClickButton: "💳 Pay with Click",
    vipPaymeButton: "💳 Pay with Payme",
    vipClickNotConfigured: "💳 Click payments aren't fully set up yet. Coming soon! 🚧",
    vipPaymeNotConfigured: "💳 Payme payments aren't connected yet. Coming soon! 🚧",
    vipJoinMessage: (link) => `🎉 Welcome! Here's the link to join the group:\n${link}`,
    discoverNoCandidates: "No matching candidates found yet. Try again later.",
    unlockLinkText: (price) => `🔐 View full profile (${price} UZS)`,
    unlockPaywallIntro:
      "🔐 Viewing this profile in full requires a payment\n\n" +
      "💳 Price: 7,900 UZS — per profile\n" +
      "🆓 (If you'd like the free way, wait for that person to like you back too 😉)\n\n" +
      "💎 If you'd like unlimited access to every candidate's profile, we recommend subscribing to Premium! ✨",
    unlockPayButton: "🔓 View this profile — 7,900 UZS",
    unlockPremiumButton: "👑 Get Premium",
    unlockNotConfigured: "🔐 Payments aren't fully set up yet. Coming soon! 🚧",
    viewProfileButton: "👁 View profile",
    unlockPaymentSuccessIntro: "🎉 Payment successful!\n\n👁 Tap the button below to view the profile:",
    matchedToast: "🎉 It's a match! You can now view the profile for free.",
    matchNotification: (name) => `🎉 You and ${name} matched! You can now view the profile for free.`,
    unlockSuccessNoContact: "✅ Payment received, but unfortunately this profile has already been removed. 😔",
    noLikesYet: "😔 No one has liked you yet.\nMore is coming soon! 🚀✨",
    likesIntro: (count) => `💌 ${count} people liked you! 😍`,
    premiumDetails:
      "💎 Premium subscription — 1 month\n\n" +
      "✅ Unlimited access to every candidate's private chat (no separate 🔐 payments)\n" +
      "✅ Your profile is shown to other users more often and more prominently\n\n" +
      "💵 Price: 69,000 UZS / month",
    premiumPayClickButton: "💳 Pay with Click",
    premiumPayClickNotConfigured: "💳 Click payments aren't fully set up yet (waiting on Merchant ID / Service ID).",
    premiumQrCaption: "📷 Or scan this QR code to pay",
    premiumActivated: (days) => `🎉 Premium activated! You'll have all the perks for ${days} days.`,
    profileSettingsIntro: "⚙️ Profile settings:",
    profileSettingsEdit: "✏️ Edit profile",
    profileSettingsView: "👁 My profile",
    profileSettingsDeactivate: "🔴 Deactivate profile",
    profileSettingsActivate: "🟢 Activate profile",
    profileDeactivated: "✅ Your profile has been deactivated. Others can no longer see it.",
    profileActivated: "✅ Your profile has been activated. Others can see it now.",
    bioLabel: "📝 About:",
    profileStatusActive: "🟢 Active",
    profileStatusInactive: "🔴 Inactive",
    profilePremiumActive: (date) => `💎 Premium: active (until ${date})`,
    profilePremiumNone: "💎 Premium: none",
    noProfileYet: "You don't have a profile yet. Fill one out first via /start.",
  },
};

function t(lang, key) {
  const dict = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  return dict[key] ?? STRINGS[DEFAULT_LANG][key];
}

module.exports = { DEFAULT_LANG, LANGUAGES, STRINGS, t };
