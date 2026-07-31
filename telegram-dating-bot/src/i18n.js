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
    errCommandInForm:
      "Hozir anketa to'ldirilyapti. Buyruqlar ishlamaydi — savolga javob yozing.\nBoshidan boshlash uchun /start yuboring.",
    confirmIntro: (linkHtml) =>
      `✅ Ma'lumotlaringizni tasdiqlaysizmi?\n\n` +
      `"Ha" tugmasini bosish orqali kiritilgan ma'lumotlar to'g'riligini tasdiqlaysiz hamda ${linkHtml} rozilik bildirasiz.\n\n` +
      `Hammasi to'g'rimi?`,
    confirmYesButton: "✅ Ha",
    confirmError: 'Iltimos, pastdagi "✅ Ha" tugmasini bosing.',
    policyLinkText: "Maxfiylik siyosati va Foydalanuvchi kelishuviga",
    mainMenuIntro: "🏠 Bosh menyu",
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
      anonChat: "🕵️ Anonim chat",
      complaint: "🚨 Shikoyat qilmoqchiman",
      referral: "🎁 Do'st taklif qilish",
    },
    anonChatIntro:
      "🕵️ Anonim chat\n\n" +
      "Bu yerda hech kim sizning shaxsingizni bilmaydi — profilingiz ko'rsatilmaydi! Suhbat aynan 3 daqiqa davom etadi.\n\n" +
      "Kim bilan suhbatlashmoqchisiz? 👇",
    anonGirlButton: "👧 Qiz bola bilan",
    anonBoyButton: "👦 O'g'il bola bilan",
    anonRandomButton: "🎲 Random",
    anonGenderPaywallIntro:
      "🔒 Muayyan jins bilan suhbatlashish — maxsus xizmat!\n\n" +
      "💳 Narxi: atigi 12 900 so'm / hafta\n" +
      "📅 Ushbu tarif faollashtirilgan kundan boshlab 7 kun davomida amal qiladi — shu muddat ichida xohlagan jinsni tanlab, cheklovsiz suhbatlashishingiz mumkin.\n\n" +
      "💎 (Premium obunangiz bo'lsa, bu funksiya sizga avtomatik ravishda BEPUL!)\n\n" +
      "To'lov qilmoqchimisiz? 😊",
    anonPayButton: "💳 To'lov qilish",
    anonNotConfigured: "💳 To'lov tizimi hali to'liq sozlanmagan. Tez orada ishga tushadi! 🚧",
    anonSubscriptionActivated: (days, until) =>
      "🎉 <b>Tabriklaymiz! Obunangiz faollashtirildi.</b>\n\n" +
      `📅 Amal qilish muddati: <b>${until}</b> gacha (${days} kun)\n\n` +
      "Shu muddat ichida cheklovsiz tanlashingiz mumkin:\n" +
      "👧 <b>Qiz bola bilan</b> — xohlagancha\n" +
      "👦 <b>O'g'il bola bilan</b> — xohlagancha\n\n" +
      "Ikkalasi ham ishlaydi va xohlagan paytda almashtirsangiz bo'ladi.\n" +
      "Pastdagi tugmalardan birini bosing 👇",
    anonFilterActive: (until) =>
      `✅ <b>Jins tanlash obunangiz faol</b> — ${until} gacha.\n` +
      "👧 va 👦 — ikkalasi ham ishlaydi.",
    anonSearching: "🔍 Qidirilmoqda...\n\nBiroz kuting, tez orada suhbatdosh topiladi! 🤞✨",
    anonMatched:
      "🎉 Topildi! Suhbatlashishni boshlang! 💬\n\n" +
      "⏳ Sizda 3 daqiqa vaqt bor. Suhbatdoshingiz haqida hech narsa bilmaysiz — u ham sizni bilmaydi. Shunchaki erkin yozavering! 😉",
    anonChatEnded: "⏰ Vaqt tugadi! Suhbat yakunlandi. 👋\n\nYana anonim suhbat qurishni xohlaysizmi? Anonim chat tugmasini bosing!",
    anonPartnerLeft: "😔 Suhbatdoshingiz chatdan chiqib ketdi.\n\nYangi suhbat boshlash uchun qaytadan urinib ko'ring!",
    anonAlreadySearching: "🔍 Siz allaqachon qidiruvda turibsiz, biroz kuting...",
    anonAlreadyInChat: "💬 Siz hozir anonim suhbatdasiz. Suhbatni tugatish uchun 🛑 Suhbatni to'xtatish tugmasini bosing.",
    anonStopButton: "🛑 Suhbatni to'xtatish",
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
    vipPayIntro: "💳 To'lovni amalga oshirish uchun quyidagi tugmani bosing:",
    vipClickButton: "💳 Click orqali to'lash",
    vipClickNotConfigured: "💳 Click to'lovi hali to'liq sozlanmagan. Tez orada ishga tushadi! 🚧",
    vipJoinMessage: (link) => `🎉 Xush kelibsiz! Guruhga qo'shilish uchun havola:\n${link}`,
    discoverNoCandidates: "Hozircha mos nomzodlar topilmadi. Keyinroq qayta urinib ko'ring.",
    discoverTemporaryProblem: "Vaqtinchalik nosozlik yuz berdi. Iltimos, biroz keyin qayta urinib ko'ring 🙏",
    unlockLinkText: (price) => `🔐 Profilni to'liq ko'rish (${price} so'm)`,
    unlockPaywallIntro:
      "🔐 Bu profilni ko'rish huquqini olishni xohlaysizmi?\n\n" +
      "💳 Xizmatimiz pullik va bu 7 900 so'mni tashkil qiladi — har bir profil uchun alohida.\n" +
      "🆓 (Agar tekin yo'ldan foydalanmoqchi bo'lsangiz, u insonning ham sizga layk bosishini kuting 😉)\n\n" +
      "💎 Agar barcha profillarni bepul, cheklovsiz ko'rmoqchi bo'lsangiz — Premium tarifga ulanishingizni maslahat beramiz! ✨",
    unlockPayButton: "🔓 Profilni ko'rish huquqini olish",
    unlockPremiumButton: "👑 Premium'ga ulanish",
    unlockNotConfigured: "🔐 To'lov tizimi hali to'liq sozlanmagan. Tez orada ishga tushadi! 🚧",
    referralScreen: ({ link, invited, credits, perCredit, remaining }) =>
      "🎁 <b>Do'stlaringizni taklif qiling</b>\n\n" +
      "Har bir do'stingiz shu yerda o'z sevgisini topishi mumkin — " +
      "siz esa buning uchun sovg'a olasiz.\n\n" +
      "🔗 <b>Sizning havolangiz:</b>\n" +
      `<code>${link}</code>\n\n` +
      `👥 Taklif qilganlaringiz: <b>${invited} ta</b>\n` +
      `🔓 Bepul ochish imkoniyati: <b>${credits} ta</b>\n\n` +
      `📌 Har <b>${perCredit} ta</b> do'stingiz anketasini to'ldirib bo'lgach, ` +
      "siz <b>1 ta</b> anketani bepul ochib ko'rasiz.\n" +
      `Keyingi bepul ochishgacha: <b>${remaining} ta</b> do'st qoldi.\n\n` +
      "⚠️ Do'stingiz anketani <b>oxirigacha</b> — telefon raqamigacha — to'ldirishi shart. " +
      "Shundagina hisobga olinadi.",
    referralShareButton: "📤 Havolani ulashish",
    // --- win-back campaign ---
    // Every number here is counted from the database at send time. A message
    // that says "new people joined" when nobody did is the fastest way to
    // teach somebody to ignore this bot.
    winbackWaiting: ({ name, waiting }) =>
      `👋 <b>${name}, sizni kutishyapti!</b>\n\n` +
      `💌 Siz yo'q ekansiz, <b>${waiting} kishi</b> sizning anketangizga layk bosdi.\n` +
      "Ular hozir ham javobingizni kutishmoqda.\n\n" +
      "Bir daqiqa vaqtingizni ajrating — kim ekanini ko'ring 👇",
    winbackFresh: ({ name, fresh, gender }) =>
      `💛 <b>${name}, sizni sog'indik!</b>\n\n` +
      `Siz kirmagan uch kunda botga <b>${fresh} ta</b> yangi ` +
      `${gender === "male" ? "qiz" : "yigit"} qo'shildi — ` +
      "ular ham jiddiy tanishuv izlab yurishibdi.\n\n" +
      "🔥 Eng yaxshi anketalar tez ketadi. Ulgurib qoling 👇",
    winbackFreshWeek: ({ name, fresh, gender }) =>
      `💔 <b>${name}, bir hafta bo'ldi...</b>\n\n` +
      `Shu vaqt ichida <b>${fresh} ta</b> yangi ` +
      `${gender === "male" ? "qiz" : "yigit"} anketa ochdi. ` +
      "Ehtimol, ular orasida aynan siz qidirayotgan inson bordir.\n\n" +
      "💛 Bitta layk — bitta imkoniyat. Bir ko'z tashlang 👇",
    winbackBrowseButton: "🔍 Anketalarni ko'rish",
    winbackMuteButton: "🔕 Bunday xabarlar kerak emas",
    winbackMuted:
      "🔕 Yaxshi, boshqa bunday xabar yubormaymiz.\n\n" +
      "Fikringiz o'zgarsa — «⚙️ Anketa sozlamalari» bo'limidan qaytadan yoqishingiz mumkin. " +
      "Layk va mos tushishlar haqidagi xabarlar esa o'z holicha qoladi.",
    referralShareText: "Men tanishuv botini topdim — sen ham qara! 💛",
    referralLinkUnavailable:
      "🎁 Taklif havolasi hozircha tayyor emas. Bir necha daqiqadan keyin qayta urinib ko'ring.",
    referralProgress: (have, need) =>
      `🎉 Yana bitta do'stingiz qo'shildi! (${have}/${need})\n` +
      `Bepul ochishgacha yana <b>${need - have} ta</b> qoldi.`,
    referralProgressWithCredits: (have, need, credits) =>
      `🎉 Yana bitta do'stingiz qo'shildi! (${have}/${need})\n` +
      `Keyingi bepul ochishgacha yana <b>${need - have} ta</b> qoldi.\n\n` +
      `💡 Eslatma: sizda allaqachon <b>${credits} ta</b> bepul profil ochish imkoniyati bor.`,
    referralCreditEarned: (need, credits) =>
      `🎉 Yana bitta do'stingiz qo'shildi! (${need}/${need})\n\n` +
      "🎁 <b>Tabriklaymiz!</b> Do'stlaringizni taklif qilganingiz uchun <b>1 ta bepul anketa ochish</b> imkoniyatini oldingiz.\n" +
      `Hozir sizda jami: <b>${credits} ta</b>.`,
    unlockPaywallWithCredits: ({ price, credits }) =>
      "🔐 <b>Bu anketani ochish</b>\n\n" +
      `💳 Bu funksiya pullik — <b>${price} so'm</b>.\n\n` +
      "🎁 Lekin siz do'stlaringizni taklif qilganingiz uchun sizda " +
      `<b>${credits} ta</b> bepul ochish imkoniyati bor.\n\n` +
      "Quyidagidan birini tanlang 👇",
    unlockPaywallNoCredits: ({ price, perCredit }) =>
      "🔐 <b>Bu anketani ochish</b>\n\n" +
      `💳 Bu funksiya pullik — <b>${price} so'm</b>.\n\n` +
      "🆓 <b>Bepul ko'rmoqchimisiz? Ikki yo'l bor:</b>\n" +
      "❤️ Unga layk bosing va u ham sizga layk bossa — anketa o'zi ochiladi, " +
      "hech qanday to'lovsiz.\n" +
      `🎁 Yoki <b>${perCredit} ta</b> do'stingizni taklif qiling — 1 ta bepul ochish sizniki.`,
    unlockUseCreditButton: (credits) => `🎁 Bepul ochish (${credits} ta bor)`,
    unlockInviteFriendsButton: "🎁 Do'stlarni taklif qilish",
    unlockCreditUsed: (left) =>
      "🎁 Bepul imkoniyatdan foydalandingiz!\n" +
      `Qolgan bepul ochishlar: <b>${left} ta</b>.`,
    unlockCreditGone: "🎁 Bepul ochish imkoniyati qolmadi.",
    profileBelowIntro: "👇 Bu insonning profili pastda:",
    unlockPaymentSuccessIntro: "🎉 To'lov muvaffaqiyatli o'tdi!",
    matchedToast: "🎉 Mos tushdingiz!",
    matchNotificationLocked: (name) =>
      `🎉 <b>Siz ${name} bilan mos tushdingiz!</b>\n\n` +
      `${name} sizning aloqangizni oldi — u sizga birinchi bo'lib yozishi mumkin.\n\n` +
      "Agar siz ham uning anketasini ochmoqchi bo'lsangiz, quyidagidan foydalaning 👇",
    matchNotification: (name) => `🎉 Siz ${name} bilan mos tushdingiz!`,
    unlockSuccessNoContact: "✅ To'lov qabul qilindi, ammo bu anketa afsuski allaqachon o'chirilgan. 😔",
    profileUnavailable:
      "😔 Bu anketa endi mavjud emas — egasi uni o'chirgan yoki yopgan.\n" +
      "Bepul ochish imkoniyatingiz saqlanib qoldi, uni boshqasiga ishlatishingiz mumkin.",
    noLikesYet: "😔 Hozircha sizni hech kim layk bosmagan.\nTez orada ko'payadi! 🚀✨",
    likesIntro: (count) => `💌 Sizni ${count} kishi layk bosdi! 😍`,
    seeWhoLikedButton: "👀 Kim layk bosganini ko'rish",
    likeMilestoneNotification: (count) =>
      `💌 <b>Sizga ${count} ta odam layk bosdi!</b>\n\n` +
      "Ular sizning javobingizni kutishmoqda 💛\n" +
      "Kim ekanini bilmoqchi bo'lsangiz, pastdagi tugmani bosing 👇",
    openProfileLink: "💬 Profilga o'tish va yozish",
    premiumDetails:
      "💎 Premium obuna — 1 oy\n\n" +
      "Premium bilan sizga nima beriladi? 👇\n\n" +
      "🔓 Har bir nomzodning shaxsiy chatiga cheksiz kirish (🔐 alohida to'lovsiz)\n" +
      "🔥 Profilingiz boshqalarga ko'proq va tez-tez ko'rsatiladi\n" +
      "🕵️ Anonim chatda xohlagan jinsni (qiz yoki o'g'il) tanlab suhbatlashish huquqi — 1 oy davomida BEPUL! (odatda 12 900 so'm/hafta turadi)\n\n" +
      "💵 Narxi: 79 900 so'm / 1 oy",
    premiumPayClickButton: "💳 Click orqali to'lash",
    premiumPayClickNotConfigured: "💳 Click to'lovi hali to'liq sozlanmagan (Merchant ID / Service ID kutilmoqda).",
    premiumQrCaption: "📷 Yoki shu QR kodni skanerlab to'lang",
    premiumActivated: (days) => `🎉 Premium faollashtirildi! ${days} kun davomida barcha imtiyozlardan foydalanasiz.`,
    profileSettingsIntro: "⚙️ Anketa sozlamalari:",
    profileSettingsEdit: "✏️ Anketani tahrirlash",
    profileSettingsView: "👁 Mening anketam",
    notificationsEnableButton: "🔔 Bildirishnomalarni yoqish",
    notificationsDisableButton: "🔕 Bildirishnomalarni o'chirish",
    notificationsEnabledNotice:
      "🔔 Yoqildi. Yangi anketalar va sizni kutayotganlar haqida xabar beramiz.",
    notificationsDisabledNotice:
      "🔕 O'chirildi. Eslatma xabarlari kelmaydi.\n\n" +
      "Layk va mos tushishlar haqidagi xabarlar esa o'z holicha qoladi.",
    profileSettingsDeactivate: "🔴 Anketani faolsizlantirish",
    profileSettingsActivate: "🟢 Anketani faollantirish",
    profileDeactivated: "✅ Anketangiz faolsizlantirildi. Endi boshqalarga ko'rinmaysiz.",
    profileActivated: "✅ Anketangiz faollashtirildi. Endi boshqalarga ko'rinasiz.",
    bioLabel: "📝 O'zi haqida:",
    profileStatusActive: "🟢 Faol",
    profileStatusInactive: "🔴 Faolsiz",
    profilePremiumActive: (date) => `💎 Premium: faol (${date} gacha)`,
    profilePremiumNone: "💎 Premium: yo'q",
    reportUserButton: "🚨 Foydalanuvchi ustidan shikoyat qilish",
    reportPartnerButton: "🚨 Suhbatdosh ustidan shikoyat qilish",
    reportNoCandidate: "Hozir ekranda hech kim yo'q. Avval anketani oching, keyin shikoyat qilishingiz mumkin.",
    anonReportOffer: "Suhbatdoshdan norozi bo'lsangiz, quyidagi tugma orqali shikoyat qoldirishingiz mumkin 👇",
    complaintPromptAbout:
      "🚨 Shu rasmdagi insondan nima shikoyatingiz bo'lsa, shu yerda yozib qoldiring.\n\n" +
      "⏱ 24 soat ichida natijasi bo'ladi, albatta!\n\n" +
      "✍️ Shikoyatingizni yozing:",
    complaintPromptGeneral:
      "🚨 Nimadan shikoyatingiz bor? Shu yerda batafsil yozib qoldiring.\n\n" +
      "⏱ 24 soat ichida natijasi bo'ladi, albatta!\n\n" +
      "✍️ Shikoyatingizni yozing:",
    complaintTooShort: "Iltimos, shikoyatingizni biroz batafsilroq yozing.",
    complaintCancelled: "Shikoyat bekor qilindi.",
    complaintFailed: "Kechirasiz, shikoyatni qabul qilib bo'lmadi. Biroz keyin qayta urinib ko'ring.",
    complaintReceived: (id) =>
      "✅ Shikoyatingiz qabul qilindi!\n\n" +
      `🆔 Shikoyat raqami: <b>${id}</b>\n` +
      "Bu raqamni saqlab qo'ying — shikoyatingizni shu raqam orqali eslatishingiz mumkin.\n\n" +
      "Uni adminga yuboramiz va uni tekshirgan holda sizga javobini aytamiz. 🙏",
    complaintAnswered: (id, reply) =>
      `📬 <b>${id}</b> raqamli shikoyatingizga javob keldi:\n\n${reply}`,
    accountDeleted:
      "❌ <b>Sizning akkauntingiz o'chirildi.</b>\n\n" +
      "Sizning profilingizda yolg'on aralashgani sezildi.\n\n" +
      "Agar bu xato deb hisoblasangiz, murojaat qilishingiz mumkin — pastdagi " +
      "«Shikoyat qilish» tugmasini bosing.\n\n" +
      "Yangi anketa to'ldirmoqchi bo'lsangiz, «Yangi profil ochish» tugmasini bosing.",
    accountDeactivated:
      "⏸ <b>Anketangiz vaqtincha yopildi.</b>\n\n" +
      "Hozircha sizning anketangiz boshqalarga ko'rinmaydi.\n\n" +
      "Sabab bilan qiziqsangiz yoki bu xato deb hisoblasangiz, pastdagi " +
      "«Shikoyat qilish» tugmasi orqali murojaat qiling.",
    accountReactivated:
      "✅ <b>Anketangiz qayta ochildi.</b>\n\nEndi u boshqalarga yana ko'rinadi.",
    newProfileButton: "🆕 Yangi profil ochish",
    complainButton: "🚨 Shikoyat qilish",
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
    errCommandInForm:
      "Сейчас заполняется анкета. Команды не работают — ответьте на вопрос.\nЧтобы начать заново, отправьте /start.",
    confirmIntro: (linkHtml) =>
      `✅ Вы подтверждаете свои данные?\n\n` +
      `Нажимая "Да", вы подтверждаете достоверность введённых данных и соглашаетесь с ${linkHtml}.\n\n` +
      `Всё верно?`,
    confirmYesButton: "✅ Да",
    confirmError: 'Пожалуйста, нажмите кнопку "✅ Да" ниже.',
    policyLinkText: "Политикой конфиденциальности и Пользовательским соглашением",
    mainMenuIntro: "🏠 Главное меню",
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
      anonChat: "🕵️ Анонимный чат",
      complaint: "🚨 Хочу пожаловаться",
      referral: "🎁 Пригласить друга",
    },
    anonChatIntro:
      "🕵️ Анонимный чат\n\n" +
      "Здесь никто не узнает, кто вы — ваш профиль не показывается! Разговор длится ровно 3 минуты.\n\n" +
      "С кем хотите пообщаться? 👇",
    anonGirlButton: "👧 С девушкой",
    anonBoyButton: "👦 С парнем",
    anonRandomButton: "🎲 Случайно",
    anonGenderPaywallIntro:
      "🔒 Выбор конкретного пола — платная услуга!\n\n" +
      "💳 Цена: всего 12 900 сум / неделя\n" +
      "📅 Этот тариф действует 7 дней с момента активации — в течение этого времени вы можете выбирать пол собеседника без ограничений.\n\n" +
      "💎 (Если у вас есть Premium, эта функция уже БЕСПЛАТНА для вас!)\n\n" +
      "Хотите оплатить? 😊",
    anonPayButton: "💳 Оплатить",
    anonNotConfigured: "💳 Оплата ещё не полностью настроена. Скоро заработает! 🚧",
    anonSubscriptionActivated: (days, until) =>
      "🎉 <b>Поздравляем! Подписка активирована.</b>\n\n" +
      `📅 Действует до: <b>${until}</b> (${days} дней)\n\n` +
      "В течение этого срока вы можете без ограничений выбирать:\n" +
      "👧 <b>С девушкой</b> — сколько угодно\n" +
      "👦 <b>С парнем</b> — сколько угодно\n\n" +
      "Работают оба варианта, переключаться можно в любой момент.\n" +
      "Нажмите одну из кнопок ниже 👇",
    anonFilterActive: (until) =>
      `✅ <b>Подписка на выбор пола активна</b> — до ${until}.\n` +
      "👧 и 👦 — работают обе кнопки.",
    anonSearching: "🔍 Идёт поиск...\n\nПодождите немного, скоро найдётся собеседник! 🤞✨",
    anonMatched:
      "🎉 Найден собеседник! Начинайте общаться! 💬\n\n" +
      "⏳ У вас есть 3 минуты. Вы ничего не знаете о собеседнике — и он о вас тоже. Пишите свободно! 😉",
    anonChatEnded: "⏰ Время вышло! Чат завершён. 👋\n\nХотите начать новый анонимный чат? Нажмите на кнопку!",
    anonPartnerLeft: "😔 Собеседник покинул чат.\n\nПопробуйте начать новый разговор!",
    anonAlreadySearching: "🔍 Вы уже в поиске, немного подождите...",
    anonAlreadyInChat: "💬 Вы сейчас в анонимном чате. Чтобы завершить его, нажмите 🛑 Завершить чат.",
    anonStopButton: "🛑 Завершить чат",
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
    vipPayIntro: "💳 Нажмите кнопку ниже, чтобы оплатить:",
    vipClickButton: "💳 Оплатить через Click",
    vipClickNotConfigured: "💳 Оплата через Click ещё не полностью настроена. Скоро заработает! 🚧",
    vipJoinMessage: (link) => `🎉 Добро пожаловать! Ссылка для вступления в группу:\n${link}`,
    discoverNoCandidates: "Подходящих анкет пока не найдено. Попробуйте позже.",
    discoverTemporaryProblem: "Произошёл временный сбой. Пожалуйста, попробуйте чуть позже 🙏",
    unlockLinkText: (price) => `🔐 Посмотреть анкету полностью (${price} сум)`,
    unlockPaywallIntro:
      "🔐 Хотите получить доступ к просмотру этой анкеты?\n\n" +
      "💳 Наша услуга платная и стоит 7 900 сум — за каждую анкету отдельно.\n" +
      "🆓 (Если хотите бесплатно, дождитесь, пока этот человек тоже поставит вам лайк 😉)\n\n" +
      "💎 Если хотите смотреть все анкеты бесплатно и без ограничений — рекомендуем подключить Premium! ✨",
    unlockPayButton: "🔓 Получить доступ к анкете",
    unlockPremiumButton: "👑 Подключить Premium",
    unlockNotConfigured: "🔐 Оплата пока не полностью настроена. Скоро заработает! 🚧",
    referralScreen: ({ link, invited, credits, perCredit, remaining }) =>
      "🎁 <b>Пригласите друзей</b>\n\n" +
      "Каждый ваш друг может найти здесь свою любовь — " +
      "а вы получите за это подарок.\n\n" +
      "🔗 <b>Ваша ссылка:</b>\n" +
      `<code>${link}</code>\n\n` +
      `👥 Вы пригласили: <b>${invited}</b>\n` +
      `🔓 Бесплатных открытий: <b>${credits}</b>\n\n` +
      `📌 За каждые <b>${perCredit}</b> друзей, заполнивших анкету, ` +
      "вы открываете <b>1</b> анкету бесплатно.\n" +
      `До следующего бесплатного открытия: <b>${remaining}</b>.\n\n` +
      "⚠️ Друг должен заполнить анкету <b>до конца</b> — включая номер телефона. " +
      "Только тогда это засчитывается.",
    referralShareButton: "📤 Поделиться ссылкой",
    winbackWaiting: ({ name, waiting }) =>
      `👋 <b>${name}, вас ждут!</b>\n\n` +
      `💌 Пока вас не было, <b>${waiting} человек</b> поставили лайк вашей анкете.\n` +
      "Они до сих пор ждут вашего ответа.\n\n" +
      "Уделите минуту — посмотрите, кто это 👇",
    winbackFresh: ({ name, fresh, gender }) =>
      `💛 <b>${name}, мы соскучились!</b>\n\n` +
      `За три дня, что вас не было, в боте появилось <b>${fresh}</b> новых ` +
      `${gender === "male" ? "девушек" : "парней"} — ` +
      "они тоже ищут серьёзное знакомство.\n\n" +
      "🔥 Лучшие анкеты разбирают быстро. Успейте 👇",
    winbackFreshWeek: ({ name, fresh, gender }) =>
      `💔 <b>${name}, прошла неделя...</b>\n\n` +
      `За это время анкеты создали <b>${fresh}</b> новых ` +
      `${gender === "male" ? "девушек" : "парней"}. ` +
      "Возможно, среди них именно тот человек, которого вы ищете.\n\n" +
      "💛 Один лайк — один шанс. Загляните 👇",
    winbackBrowseButton: "🔍 Посмотреть анкеты",
    winbackMuteButton: "🔕 Такие сообщения не нужны",
    winbackMuted:
      "🔕 Хорошо, больше таких сообщений не будет.\n\n" +
      "Передумаете — включите обратно в «⚙️ Настройки анкеты». " +
      "Уведомления о лайках и совпадениях останутся как были.",
    referralShareText: "Нашёл бот знакомств — посмотри и ты! 💛",
    referralLinkUnavailable:
      "🎁 Ссылка пока не готова. Попробуйте через несколько минут.",
    referralProgress: (have, need) =>
      `🎉 Ещё один друг присоединился! (${have}/${need})\n` +
      `До бесплатного открытия осталось: <b>${need - have}</b>.`,
    referralProgressWithCredits: (have, need, credits) =>
      `🎉 Ещё один друг присоединился! (${have}/${need})\n` +
      `До следующего бесплатного открытия осталось: <b>${need - have}</b>.\n\n` +
      `💡 Напоминаем: у вас уже есть <b>${credits}</b> бесплатных открытия анкеты.`,
    referralCreditEarned: (need, credits) =>
      `🎉 Ещё один друг присоединился! (${need}/${need})\n\n` +
      "🎁 <b>Поздравляем!</b> За приглашённых друзей вы получили <b>1 бесплатное открытие анкеты</b>.\n" +
      `Сейчас у вас всего: <b>${credits}</b>.`,
    unlockPaywallWithCredits: ({ price, credits }) =>
      "🔐 <b>Открыть эту анкету</b>\n\n" +
      `💳 Услуга платная — <b>${price} сум</b>.\n\n` +
      "🎁 Но за приглашённых друзей у вас есть " +
      `<b>${credits}</b> бесплатных открытий.\n\n` +
      "Выберите 👇",
    unlockPaywallNoCredits: ({ price, perCredit }) =>
      "🔐 <b>Открыть эту анкету</b>\n\n" +
      `💳 Услуга платная — <b>${price} сум</b>.\n\n` +
      "🆓 <b>Хотите бесплатно? Есть два пути:</b>\n" +
      "❤️ Поставьте лайк и дождитесь ответного — анкета откроется сама, без оплаты.\n" +
      `🎁 Или пригласите <b>${perCredit}</b> друзей — одно бесплатное открытие ваше.`,
    unlockUseCreditButton: (credits) => `🎁 Открыть бесплатно (есть ${credits})`,
    unlockInviteFriendsButton: "🎁 Пригласить друзей",
    unlockCreditUsed: (left) =>
      "🎁 Вы использовали бесплатное открытие!\n" +
      `Осталось: <b>${left}</b>.`,
    unlockCreditGone: "🎁 Бесплатных открытий не осталось.",
    profileBelowIntro: "👇 Профиль этого человека ниже:",
    unlockPaymentSuccessIntro: "🎉 Оплата прошла успешно!",
    matchedToast: "🎉 Это совпадение!",
    matchNotificationLocked: (name) =>
      `🎉 <b>У вас совпадение с ${name}!</b>\n\n` +
      `${name} получил(а) ваши контакты — может написать вам первым.\n\n` +
      "Если вы тоже хотите открыть анкету, выберите ниже 👇",
    matchNotification: (name) => `🎉 У вас взаимная симпатия с ${name}!`,
    unlockSuccessNoContact: "✅ Оплата получена, но, к сожалению, эта анкета уже удалена. 😔",
    profileUnavailable:
      "😔 Этой анкеты больше нет — владелец удалил или закрыл её.\n" +
      "Ваше бесплатное открытие сохранено, потратите его на другую.",
    noLikesYet: "😔 Пока никто не поставил вам лайк.\nСкоро их станет больше! 🚀✨",
    likesIntro: (count) => `💌 Вам поставили лайк ${count} человек! 😍`,
    seeWhoLikedButton: "👀 Посмотреть, кто лайкнул",
    likeMilestoneNotification: (count) =>
      `💌 <b>Вам поставили лайк ${count} человек!</b>\n\n` +
      "Они ждут вашего ответа 💛\n" +
      "Хотите узнать, кто это — нажмите кнопку ниже 👇",
    openProfileLink: "💬 Перейти в профиль и написать",
    premiumDetails:
      "💎 Премиум подписка — 1 месяц\n\n" +
      "Что вы получаете с Premium? 👇\n\n" +
      "🔓 Неограниченный доступ к личному чату каждого кандидата (без отдельной оплаты 🔐)\n" +
      "🔥 Ваш профиль показывается другим пользователям чаще и заметнее\n" +
      "🕵️ Возможность выбирать пол собеседника в анонимном чате — БЕСПЛАТНО весь месяц! (обычно 12 900 сум/неделя)\n\n" +
      "💵 Цена: 79 900 сум / 1 месяц",
    premiumPayClickButton: "💳 Оплатить через Click",
    premiumPayClickNotConfigured: "💳 Оплата через Click ещё не полностью настроена (ожидаются Merchant ID / Service ID).",
    premiumQrCaption: "📷 Или отсканируйте этот QR-код для оплаты",
    premiumActivated: (days) => `🎉 Премиум активирован! Все привилегии доступны в течение ${days} дней.`,
    profileSettingsIntro: "⚙️ Настройки анкеты:",
    profileSettingsEdit: "✏️ Редактировать анкету",
    profileSettingsView: "👁 Моя анкета",
    notificationsEnableButton: "🔔 Включить уведомления",
    notificationsDisableButton: "🔕 Отключить уведомления",
    notificationsEnabledNotice:
      "🔔 Включено. Будем сообщать о новых анкетах и о тех, кто вас ждёт.",
    notificationsDisabledNotice:
      "🔕 Отключено. Напоминания приходить не будут.\n\n" +
      "Уведомления о лайках и совпадениях остаются как были.",
    profileSettingsDeactivate: "🔴 Деактивировать анкету",
    profileSettingsActivate: "🟢 Активировать анкету",
    profileDeactivated: "✅ Ваша анкета деактивирована. Теперь она не видна другим.",
    profileActivated: "✅ Ваша анкета активирована. Теперь она видна другим.",
    bioLabel: "📝 О себе:",
    profileStatusActive: "🟢 Активна",
    profileStatusInactive: "🔴 Неактивна",
    profilePremiumActive: (date) => `💎 Премиум: активен (до ${date})`,
    profilePremiumNone: "💎 Премиум: нет",
    reportUserButton: "🚨 Пожаловаться на пользователя",
    reportPartnerButton: "🚨 Пожаловаться на собеседника",
    reportNoCandidate: "Сейчас на экране никого нет. Сначала откройте анкету, потом сможете пожаловаться.",
    anonReportOffer: "Если собеседник вас чем-то не устроил, можете оставить жалобу по кнопке ниже 👇",
    complaintPromptAbout:
      "🚨 Напишите здесь, что именно вас не устроило в человеке с этого фото.\n\n" +
      "⏱ Результат будет в течение 24 часов, обязательно!\n\n" +
      "✍️ Опишите жалобу:",
    complaintPromptGeneral:
      "🚨 На что вы хотите пожаловаться? Опишите подробно здесь.\n\n" +
      "⏱ Результат будет в течение 24 часов, обязательно!\n\n" +
      "✍️ Опишите жалобу:",
    complaintTooShort: "Пожалуйста, опишите жалобу чуть подробнее.",
    complaintCancelled: "Жалоба отменена.",
    complaintFailed: "Извините, не удалось принять жалобу. Попробуйте чуть позже.",
    complaintReceived: (id) =>
      "✅ Ваша жалоба принята!\n\n" +
      `🆔 Номер жалобы: <b>${id}</b>\n` +
      "Сохраните этот номер — по нему вы сможете сослаться на свою жалобу.\n\n" +
      "Мы передадим её администратору, он всё проверит и мы сообщим вам ответ. 🙏",
    complaintAnswered: (id, reply) =>
      `📬 Пришёл ответ на вашу жалобу <b>${id}</b>:\n\n${reply}`,
    accountDeleted:
      "❌ <b>Ваш аккаунт удалён.</b>\n\n" +
      "В вашей анкете были замечены недостоверные данные.\n\n" +
      "Если вы считаете это ошибкой, вы можете обратиться к нам — нажмите кнопку " +
      "«Пожаловаться» ниже.\n\n" +
      "Если хотите заполнить новую анкету, нажмите «Создать новую анкету».",
    accountDeactivated:
      "⏸ <b>Ваша анкета временно скрыта.</b>\n\n" +
      "Пока что другие пользователи её не видят.\n\n" +
      "Если хотите узнать причину или считаете это ошибкой, обратитесь к нам " +
      "через кнопку «Пожаловаться» ниже.",
    accountReactivated:
      "✅ <b>Ваша анкета снова открыта.</b>\n\nТеперь её опять видят другие.",
    newProfileButton: "🆕 Создать новую анкету",
    complainButton: "🚨 Пожаловаться",
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
    errCommandInForm:
      "The form is open. Commands do nothing here -- answer the question.\nSend /start to begin again.",
    confirmIntro: (linkHtml) =>
      `✅ Do you confirm your details?\n\n` +
      `By tapping "Yes", you confirm that the information you entered is accurate and agree to the ${linkHtml}.\n\n` +
      `Is everything correct?`,
    confirmYesButton: "✅ Yes",
    confirmError: 'Please tap the "✅ Yes" button below.',
    policyLinkText: "Privacy Policy and User Agreement",
    mainMenuIntro: "🏠 Main menu",
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
      anonChat: "🕵️ Anonymous chat",
      complaint: "🚨 I want to report",
      referral: "🎁 Invite a friend",
    },
    anonChatIntro:
      "🕵️ Anonymous chat\n\n" +
      "No one will know who you are here — your profile isn't shown! The conversation lasts exactly 3 minutes.\n\n" +
      "Who would you like to chat with? 👇",
    anonGirlButton: "👧 With a girl",
    anonBoyButton: "👦 With a guy",
    anonRandomButton: "🎲 Random",
    anonGenderPaywallIntro:
      "🔒 Choosing a specific gender is a paid feature!\n\n" +
      "💳 Price: only 12,900 UZS / week\n" +
      "📅 This plan lasts 7 days from activation — during that time you can pick either gender with no limits.\n\n" +
      "💎 (If you have Premium, this feature is already FREE for you!)\n\n" +
      "Would you like to pay? 😊",
    anonPayButton: "💳 Pay",
    anonNotConfigured: "💳 Payments aren't fully set up yet. Coming soon! 🚧",
    anonSubscriptionActivated: (days, until) =>
      "🎉 <b>Congrats! Your subscription is active.</b>\n\n" +
      `📅 Valid until: <b>${until}</b> (${days} days)\n\n` +
      "For that whole period you can pick, as often as you like:\n" +
      "👧 <b>With a girl</b>\n" +
      "👦 <b>With a boy</b>\n\n" +
      "Both work, and you can switch between them any time.\n" +
      "Tap one of the buttons below 👇",
    anonFilterActive: (until) =>
      `✅ <b>Your gender-choice subscription is active</b> — until ${until}.\n` +
      "👧 and 👦 — both buttons work.",
    anonSearching: "🔍 Searching...\n\nHang tight, a chat partner will be found soon! 🤞✨",
    anonMatched:
      "🎉 Found someone! Start chatting! 💬\n\n" +
      "⏳ You have 3 minutes. You know nothing about them, and they know nothing about you. Just write freely! 😉",
    anonChatEnded: "⏰ Time's up! The chat has ended. 👋\n\nWant to start a new anonymous chat? Tap the button!",
    anonPartnerLeft: "😔 Your chat partner left.\n\nTry starting a new conversation!",
    anonAlreadySearching: "🔍 You're already searching, hang on...",
    anonAlreadyInChat: "💬 You're currently in an anonymous chat. Tap 🛑 Stop the chat to end it.",
    anonStopButton: "🛑 Stop the chat",
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
    vipPayIntro: "💳 Tap the button below to pay:",
    vipClickButton: "💳 Pay with Click",
    vipClickNotConfigured: "💳 Click payments aren't fully set up yet. Coming soon! 🚧",
    vipJoinMessage: (link) => `🎉 Welcome! Here's the link to join the group:\n${link}`,
    discoverNoCandidates: "No matching candidates found yet. Try again later.",
    discoverTemporaryProblem: "Something went wrong for a moment. Please try again shortly 🙏",
    unlockLinkText: (price) => `🔐 View full profile (${price} UZS)`,
    unlockPaywallIntro:
      "🔐 Want to get access to view this profile?\n\n" +
      "💳 Our service is paid and costs 7,900 UZS — per profile.\n" +
      "🆓 (If you'd like the free way, wait for that person to like you back too 😉)\n\n" +
      "💎 If you'd like unlimited free access to every profile — we recommend subscribing to Premium! ✨",
    unlockPayButton: "🔓 Get access to this profile",
    unlockPremiumButton: "👑 Get Premium",
    unlockNotConfigured: "🔐 Payments aren't fully set up yet. Coming soon! 🚧",
    referralScreen: ({ link, invited, credits, perCredit, remaining }) =>
      "🎁 <b>Invite your friends</b>\n\n" +
      "Every friend you bring can find their person here — " +
      "and you get something for it.\n\n" +
      "🔗 <b>Your link:</b>\n" +
      `<code>${link}</code>\n\n` +
      `👥 Invited: <b>${invited}</b>\n` +
      `🔓 Free unlocks: <b>${credits}</b>\n\n` +
      `📌 For every <b>${perCredit}</b> friends who complete their profile, ` +
      "you unlock <b>1</b> profile for free.\n" +
      `Until the next free unlock: <b>${remaining}</b>.\n\n` +
      "⚠️ Your friend must finish the whole form — phone number included. " +
      "Only then does it count.",
    referralShareButton: "📤 Share the link",
    winbackWaiting: ({ name, waiting }) =>
      `👋 <b>${name}, people are waiting for you!</b>\n\n` +
      `💌 While you were away, <b>${waiting} people</b> liked your profile.\n` +
      "They are still waiting to hear back.\n\n" +
      "Take a minute -- see who they are 👇",
    winbackFresh: ({ name, fresh, gender }) =>
      `💛 <b>${name}, we have missed you!</b>\n\n` +
      `In the three days you were away, <b>${fresh}</b> new ` +
      `${gender === "male" ? "women" : "men"} joined -- ` +
      "looking for something serious, same as you.\n\n" +
      "🔥 The best profiles do not stay free for long 👇",
    winbackFreshWeek: ({ name, fresh, gender }) =>
      `💔 <b>${name}, it has been a week...</b>\n\n` +
      `In that time <b>${fresh}</b> new ` +
      `${gender === "male" ? "women" : "men"} created a profile. ` +
      "One of them might be exactly who you are looking for.\n\n" +
      "💛 One like, one chance. Take a look 👇",
    winbackBrowseButton: "🔍 Browse profiles",
    winbackMuteButton: "🔕 Stop sending these",
    winbackMuted:
      "🔕 Done -- no more messages like this.\n\n" +
      "Changed your mind? Turn them back on in \"⚙️ Profile settings\". " +
      "Like and match notifications are untouched.",
    referralShareText: "Found a dating bot — take a look! 💛",
    referralLinkUnavailable:
      "🎁 The invite link is not ready yet. Try again in a few minutes.",
    referralProgress: (have, need) =>
      `🎉 One more friend joined! (${have}/${need})\n` +
      `<b>${need - have}</b> to go until a free unlock.`,
    referralProgressWithCredits: (have, need, credits) =>
      `🎉 One more friend joined! (${have}/${need})\n` +
      `<b>${need - have}</b> to go until the next free unlock.\n\n` +
      `💡 Reminder: you already have <b>${credits}</b> free profile unlocks available.`,
    referralCreditEarned: (need, credits) =>
      `🎉 One more friend joined! (${need}/${need})\n\n` +
      "🎁 <b>Nice one!</b> Your invites earned you <b>1 free profile unlock</b>.\n" +
      `You now have <b>${credits}</b> in total.`,
    unlockPaywallWithCredits: ({ price, credits }) =>
      "🔐 <b>Unlock this profile</b>\n\n" +
      `💳 This is a paid feature — <b>${price} UZS</b>.\n\n` +
      "🎁 But your invites left you " +
      `<b>${credits}</b> free unlocks.\n\n` +
      "Pick one 👇",
    unlockPaywallNoCredits: ({ price, perCredit }) =>
      "🔐 <b>Unlock this profile</b>\n\n" +
      `💳 This is a paid feature — <b>${price} UZS</b>.\n\n` +
      "🆓 <b>Want it free? Two ways:</b>\n" +
      "❤️ Like them and wait for a like back — the profile opens by itself, no payment.\n" +
      `🎁 Or invite <b>${perCredit}</b> friends and one free unlock is yours.`,
    unlockUseCreditButton: (credits) => `🎁 Unlock free (${credits} left)`,
    unlockInviteFriendsButton: "🎁 Invite friends",
    unlockCreditUsed: (left) =>
      "🎁 Free unlock used!\n" +
      `Remaining: <b>${left}</b>.`,
    unlockCreditGone: "🎁 No free unlocks left.",
    profileBelowIntro: "👇 Their profile is below:",
    unlockPaymentSuccessIntro: "🎉 Payment successful!",
    matchedToast: "🎉 It's a match!",
    matchNotificationLocked: (name) =>
      `🎉 <b>It's a match with ${name}!</b>\n\n` +
      `${name} has your contact and can write to you first.\n\n` +
      "If you want to open their profile too, pick below 👇",
    matchNotification: (name) => `🎉 You and ${name} matched!`,
    unlockSuccessNoContact: "✅ Payment received, but unfortunately this profile has already been removed. 😔",
    profileUnavailable:
      "😔 This profile is gone -- the owner deleted or closed it.\n" +
      "Your free unlock is untouched; spend it on someone else.",
    noLikesYet: "😔 No one has liked you yet.\nMore is coming soon! 🚀✨",
    likesIntro: (count) => `💌 ${count} people liked you! 😍`,
    seeWhoLikedButton: "👀 See who liked me",
    likeMilestoneNotification: (count) =>
      `💌 <b>${count} people have liked you!</b>\n\n` +
      "They are waiting to hear back 💛\n" +
      "Tap below to see who 👇",
    openProfileLink: "💬 Open profile and message",
    premiumDetails:
      "💎 Premium subscription — 1 month\n\n" +
      "What do you get with Premium? 👇\n\n" +
      "🔓 Unlimited access to every candidate's private chat (no separate 🔐 payments)\n" +
      "🔥 Your profile is shown to other users more often and more prominently\n" +
      "🕵️ Choose either gender to chat with in Anonymous chat — FREE for the whole month! (normally 12,900 UZS/week)\n\n" +
      "💵 Price: 79,900 UZS / month",
    premiumPayClickButton: "💳 Pay with Click",
    premiumPayClickNotConfigured: "💳 Click payments aren't fully set up yet (waiting on Merchant ID / Service ID).",
    premiumQrCaption: "📷 Or scan this QR code to pay",
    premiumActivated: (days) => `🎉 Premium activated! You'll have all the perks for ${days} days.`,
    profileSettingsIntro: "⚙️ Profile settings:",
    profileSettingsEdit: "✏️ Edit profile",
    profileSettingsView: "👁 My profile",
    notificationsEnableButton: "🔔 Turn notifications on",
    notificationsDisableButton: "🔕 Turn notifications off",
    notificationsEnabledNotice:
      "🔔 On. We will tell you about new profiles and about people waiting for you.",
    notificationsDisabledNotice:
      "🔕 Off. No more reminders.\n\n" +
      "Like and match notifications are untouched.",
    profileSettingsDeactivate: "🔴 Deactivate profile",
    profileSettingsActivate: "🟢 Activate profile",
    profileDeactivated: "✅ Your profile has been deactivated. Others can no longer see it.",
    profileActivated: "✅ Your profile has been activated. Others can see it now.",
    bioLabel: "📝 About:",
    profileStatusActive: "🟢 Active",
    profileStatusInactive: "🔴 Inactive",
    profilePremiumActive: (date) => `💎 Premium: active (until ${date})`,
    profilePremiumNone: "💎 Premium: none",
    reportUserButton: "🚨 Report this user",
    reportPartnerButton: "🚨 Report your chat partner",
    reportNoCandidate: "There's nobody on screen right now. Open a profile first, then you can report it.",
    anonReportOffer: "If something was wrong with your chat partner, you can report them with the button below 👇",
    complaintPromptAbout:
      "🚨 Write here what exactly is wrong with the person in this photo.\n\n" +
      "⏱ You'll get a result within 24 hours, guaranteed!\n\n" +
      "✍️ Describe your report:",
    complaintPromptGeneral:
      "🚨 What would you like to report? Describe it in detail here.\n\n" +
      "⏱ You'll get a result within 24 hours, guaranteed!\n\n" +
      "✍️ Describe your report:",
    complaintTooShort: "Please describe your report in a little more detail.",
    complaintCancelled: "Report cancelled.",
    complaintFailed: "Sorry, the report couldn't be filed. Please try again shortly.",
    complaintReceived: (id) =>
      "✅ Your report has been received!\n\n" +
      `🆔 Report number: <b>${id}</b>\n` +
      "Keep this number -- you can use it to refer back to your report.\n\n" +
      "We'll pass it to an admin, they'll review it and we'll get back to you with an answer. 🙏",
    complaintAnswered: (id, reply) =>
      `📬 There's a reply to your report <b>${id}</b>:\n\n${reply}`,
    accountDeleted:
      "❌ <b>Your account has been deleted.</b>\n\n" +
      "Your profile was found to contain false information.\n\n" +
      "If you believe this is a mistake, you can get in touch -- tap " +
      "\"Report a problem\" below.\n\n" +
      "If you'd like to fill out a new profile, tap \"Create a new profile\".",
    accountDeactivated:
      "⏸ <b>Your profile has been hidden for now.</b>\n\n" +
      "Other people cannot see it at the moment.\n\n" +
      "If you want to know why, or think this is a mistake, get in touch using " +
      "the \"Report a problem\" button below.",
    accountReactivated:
      "✅ <b>Your profile is visible again.</b>\n\nOther people can see it once more.",
    newProfileButton: "🆕 Create a new profile",
    complainButton: "🚨 Report a problem",
    noProfileYet: "You don't have a profile yet. Fill one out first via /start.",
  },
};

function t(lang, key) {
  const dict = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  return dict[key] ?? STRINGS[DEFAULT_LANG][key];
}

module.exports = { DEFAULT_LANG, LANGUAGES, STRINGS, t };
