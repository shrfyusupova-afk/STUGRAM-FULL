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
    // The old wording here threatened deletion. It read as a warning to
    // somebody who had not done anything yet, at the one step people are
    // already most self-conscious about -- so it was the likeliest place to
    // lose a good user. The reason is the same either way, so it is simply
    // explained instead: a face is what makes an anketa trustworthy.
    askMedia:
      "📸 Rasm yoki video yuboring\n\n" +
      "Iloji bo'lsa, yuzingiz aniq ko'rinib turgan tiniq rasm tanlang 🙂\n\n" +
      "Yuzi ko'rinmagan anketalar boshqalarda shubha uyg'otadi va kamroq javob oladi — " +
      "ochiq rasm esa ishonch beradi va tanishuv ehtimolini sezilarli oshiradi 💛",
    errMedia: "Iltimos, rasm yoki video yuboring:",
    askLocation:
      "📍 Qayerdansiz?\n\n" +
      "Shahringiz yoki tumaningiz nomini yozing — masalan: <b>Chilonzor</b>, <b>Mirobod</b>, " +
      "<b>Samarqand</b>, <b>Namangan</b>.\n\n" +
      "Yoki pastdagi tugma orqali joylashuvingizni yuboring 👇",
    locationButton: "📍 Lokatsiya yuborish",
    errLocation: "Iltimos, manzilingizni matn shaklida kiriting yoki joylashuvingizni yuboring:",
    errLocationUnknown:
      "🤔 Bunday shahar yoki tumanni topa olmadim.\n\n" +
      "Iltimos, haqiqiy nomini yozing — masalan: <b>Chilonzor</b>, <b>Yunusobod</b>, <b>Mirobod</b>, " +
      "<b>Sergeli</b>, <b>Samarqand</b>, <b>Buxoro</b>, <b>Farg'ona</b>, <b>Namangan</b>, <b>Andijon</b>.\n\n" +
      "Yoki eng osoni — pastdagi 📍 tugmasini bosing, joylashuvingiz o'zi aniqlanadi 👇",
    distanceNear: "yaqin",
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
    // Shown once, right after a brand-new anketa is finished -- not on an
    // edit, where profileSaved above (the actual data, so they can check it)
    // is more useful than a pitch they have already heard.
    welcomeAfterRegistration: (p) =>
      `🎉 Xush kelibsiz ForOne oilasiga, ${p.name}!\n\n` +
      "💛 Yangi tanishuvlar, chin do'stlik va sevgi — aynan shu yerda\n" +
      "🎁 Do'stlaringizni taklif qiling — bepul sovg'alar oling\n" +
      "🕵️ Xohlasangiz, hech kim bilmaydigan anonim suhbat ham bor\n\n" +
      "Balki aynan bugun taqdiringiz o'zgaradi 💍\n" +
      "Pastdagi menyudan boshlang 👇",
    menu: {
      discover: "🔍 Yangi tanishuvlar",
      profile: "⚙️ Anketa sozlamalari",
      likes: "💌 Kimlar yoqtirdi",
      vip: "👑 VIP suhbat",
      premium: "💎 Premium",
      anonChat: "🕵️ Anonim chat",
      complaint: "🚨 Shikoyat qilmoqchiman",
      referral: "🎁 Do'st taklif qilish",
      forResult: "📊 ForResult — reklama taxtasi",
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
    // The price is a parameter, never typed in here: a hardcoded copy goes
    // stale the moment the constant changes, and this text is the one place
    // a user reads it before paying.
    vipIntro: (price) =>
      "👑 VIP Chat — bu yerda sizni nimalar kutmoqda?\n\n" +
      "🎉 Yangi do'stlar orttirasiz\n" +
      "🎲 Mafiya o'yinini o'ynab, ajoyib hordiq chiqarasiz\n" +
      "💃 Kundan-kunga ko'payib borayotgan qizlar bilan tanishasiz\n" +
      "💍 Omadingiz kelsa — hayotingizning yarim bo'lagini shu yerda topishingiz mumkin!\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "⏳ <b>NIMAGA AYNAN HOZIR?</b>\n\n" +
      "Guruhga har kuni yangi qizlar qo'shilmoqda. Va qizlar qancha ko'p bo'lsa — " +
      "kirish shuncha qimmatlashadi 📈\n\n" +
      `Bugungi narx — <b>${price} so'm</b>. Bu <b>eng arzon narx</b>, ` +
      "va u boshqa hech qachon bunchalik past bo'lmaydi.\n\n" +
      "🔥 Bir marta to'laysiz — <b>umrbod</b> qolasiz. Ertaga kirganlar ko'proq to'laydi.\n" +
      "━━━━━━━━━━━━━━\n\n" +
      "💵 Narxi:\n" +
      `👦 Yigitlar uchun — <b>${price} so'm</b> (hozircha)\n` +
      "👧 Qizlar uchun — 🆓 Mutlaqo bepul\n\n" +
      "💎 <b>Premium obunangiz bo'lsa — bu guruh sizga hozircha BEPUL.</b> " +
      "Lekin bu vaqtinchalik: guruh to'lgani sari VIP alohida to'lovga o'tadi.\n\n" +
      "😉 Va'da beraman — bu yerda zerikishga vaqtingiz bo'lmaydi!",
    vipPayButton: "💳 To'lov qilmoqchiman",
    vipJoinFreeButton: "🔗 Bepul qo'shilish",
    vipPayIntro: "💳 To'lovni amalga oshirish uchun quyidagi tugmani bosing:",
    vipJoinMessage: (link) => `🎉 Xush kelibsiz! Guruhga qo'shilish uchun havola:\n${link}`,
    // Women join free, but through a request an admin approves -- so the
    // message has to set that expectation before they tap, or an unanswered
    // request reads as a broken link.
    // Says WHY it is free and that it will not always be. A perk nobody knows
    // they have is not a perk -- and one that quietly disappears later reads
    // as something taken away rather than a promotion that ended.
    vipPremiumBonusMessage: (link) =>
      `👑 <b>Premium egasi sifatida VIP guruh siz uchun BEPUL!</b>\n\n` +
      `🔗 Qo'shilish uchun havola:\n${link}\n\n` +
      `⏳ <i>Diqqat: bu vaqtinchalik imtiyoz. Guruh hozir yangi — a'zolar ko'paygan sari ` +
      `VIP guruhga kirish alohida to'lovga o'tadi va Premiumga kirmay qoladi. ` +
      `Hozir kirib qolganlar esa guruhda qoladi.</i>`,
    vipJoinRequestMessage: (link) =>
      `🎉 Guruhga qo'shilish uchun havola:\n${link}\n\n` +
      `📩 Havolani bosganingizda so'rov yuboriladi — administrator tasdiqlagach guruhga kirasiz. ` +
      `Odatda bu tez bo'ladi, biroz kutib turing 💛`,
    discoverNoCandidates:
      "🌱 Siz bizdagi barcha mos nomzodlarni ko'rib chiqdingiz!\n\n" +
      "ForOne hali yosh loyiha — ochilganimizga ko'p bo'lmagani uchun anketalar hozircha tugadi. " +
      "Lekin har kuni yangi odamlar qo'shilib bormoqda, tez orada yana yangi tanishuvlar sizni kutadi 💛\n\n" +
      "Bu orada:\n" +
      "🎁 Do'stlaringizni taklif qiling — har 3 ta do'st uchun 1 ta bepul profil ochish sovg'a qiladi\n" +
      "👑 Boshqa funksiyalarni (Premium, VIP suhbat) sinab ko'ring\n\n" +
      "Do'stlaringizga botni ulashing — ular ham sevgisini topadi, siz esa sovrin yutasiz! 🏆",
    discoverTemporaryProblem: "Vaqtinchalik nosozlik yuz berdi. Iltimos, biroz keyin qayta urinib ko'ring 🙏",
    unlockLinkText: "🔐 Profilni to'liq ko'rish huquqini olish",
    unlockPremiumButton: "👑 Premium'ga ulanish",
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
    matchedToast: "🎉 Mos tushdingiz!",
    // The half of a match that is NOT opened. Only whoever liked first gets
    // the contact -- they took the risk on a stranger -- so this has to tell
    // the one answering exactly where they stand, without pretending the
    // match gave them something it did not.
    matchNotificationLocked: (name) =>
      `🎉 <b>Siz ${name} bilan mos tushdingiz!</b>\n\n` +
      `${name} sizning aloqangizni oldi — u sizga birinchi bo'lib yozishi mumkin.\n\n` +
      "Agar siz ham uning anketasini ochmoqchi bo'lsangiz, quyidagidan foydalaning 👇",
    // Sent to whoever liked FIRST -- the only one holding the contact, so the
    // only one who can start anything. Saying just "it's a match" left both
    // people waiting for the other; this says whose move it is and why.
    matchNotification: (name) =>
      `🎉 <b>Siz ${name} bilan mos tushdingiz!</b>\n\n` +
      `💬 Endi navbat sizda: <b>${name}</b> sizning xabaringizni kutmoqda. ` +
      `Aloqa faqat sizda — shuning uchun birinchi bo'lib siz yozasiz 😊`,
    unlockSuccessNoContact: "✅ To'lov qabul qilindi, ammo bu anketa afsuski allaqachon o'chirilgan. 😔",
    profileUnavailable:
      "😔 Bu anketa endi mavjud emas — egasi uni o'chirgan yoki yopgan.\n" +
      "Bepul ochish imkoniyatingiz saqlanib qoldi, uni boshqasiga ishlatishingiz mumkin.",
    noLikesYet: "😔 Hozircha sizni hech kim layk bosmagan.\nTez orada ko'payadi! 🚀✨",
    likesIntro: (count) => `💌 Sizni ${count} kishi layk bosdi! 😍\n\nBirma-bir ko'rib chiqamiz 👇`,
    likesNextButton: (position, total) => `➡️ Keyingisi (${position}/${total})`,
    likesAllSeen:
      "✅ Sizni layk bosganlarning hammasini ko'rib chiqdingiz!\n\n" +
      "Yangi layklar kelsa, xabar beramiz 💌",
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
      "🕵️ Anonim chatda xohlagan jinsni (qiz yoki o'g'il) tanlab suhbatlashish huquqi — 1 oy davomida BEPUL! (odatda 12 900 so'm/hafta turadi)\n" +
      "👑 VIP guruhga kirish — hozircha BEPUL (odatda 21 900 so'm)\n\n" +
      "⏳ VIP guruh imtiyozi vaqtinchalik: guruh to'lgani sari u alohida to'lovga o'tadi.\n\n" +
      "💵 Narxi: 79 900 so'm / 1 oy",
    // One entry per provider, named after the provider key in checkout.js.
    // --- ForOne kanali ---
    channelGateText:
      "📣 <b>ForOne rasmiy kanali</b>\n\n" +
      "Davom etishdan oldin kanalimizga obuna bo'ling 💛\n\n" +
      "Kanalda nima bor:\n" +
      "🎁 Faqat obunachilar uchun sovg'alar va bepul imkoniyatlar\n" +
      "✨ Yangi funksiyalar — birinchi bo'lib siz bilasiz\n" +
      "💡 Tanishuvda ishlaydigan maslahatlar\n" +
      "🏆 Konkurslar va sovrinlar\n\n" +
      "Obuna bo'ling va pastdagi tugmani bosing 👇",
    channelJoinButton: "📣 Kanalga obuna bo'lish",
    channelCheckButton: "✅ Obuna bo'ldim",
    channelJoinedToast: "✅ Rahmat! Davom etamiz 💛",
    channelNotJoinedToast: "❌ Obuna topilmadi.\n\nAvval kanalga kiring va \"Obuna bo'lish\" tugmasini bosing, keyin qaytadan tekshiring.",
    channelWelcomeInvite:
      "📣 <b>Bizning kanalga qo'shiling!</b>\n\n" +
      "ForOne kanalida sizni kutmoqda:\n" +
      "🎁 Obunachilar uchun sovg'alar\n" +
      "✨ Yangi funksiyalar haqida birinchi xabar\n" +
      "💡 Tanishuvda haqiqatan ishlaydigan maslahatlar\n\n" +
      "Bir tugma — va hech narsani o'tkazib yubormaysiz 👇",
    // Shown only when NO payment provider is configured. Deliberately names
    // both, so an operator reading a user's screenshot knows what is missing.
    payButtonGeneric: "💳 To'lov qilish",
    paymentsNotConfigured:
      "💳 To'lov tizimi hali sozlanmagan (Click va Payme kutilmoqda).\n\nTez orada ishga tushadi! 🚧",
    qrCaptionFor: (provider) => `📷 QR kodni skaner qilib, ${provider} orqali to'lang`,
    payWith_click: "💳 Click orqali to'lash",
    payWith_payme: "💳 Payme orqali to'lash",
    // Appended to every paywall. A URL button hands the person over to the
    // provider's site and Telegram tells the bot nothing about it -- so the
    // only way they know what happens when they come back is if we say so
    // before they leave.
    paymentHowToNote: (providers) =>
      "━━━━━━━━━━━━━━\n" +
      `1️⃣ ${providers} tugmasini bosing\n` +
      "2️⃣ To'lovni amalga oshiring\n" +
      "3️⃣ So'ng «✅ To'lov qildim» tugmasini bosing\n\n" +
      "⏳ To'lov tasdiqlangach, funksiya bir necha soniyada ishga tushadi.",
    // Click is not everyone's bank. Rather than leave a person stuck on a
    // provider that doesn't work for them, every paywall says plainly that
    // there is another way through -- a human, not just another button.
    paymentAdminHelpNote: "(Agar sizda Click bo'lmasa bu muammo emas 😊 adminimizga murojaat qiling @ForOnebest)",
    // --- ForResult: the paid advertising board ---------------------------
    //
    // Written to sell, because that is what the screen is for -- but every
    // number in it comes from the real board, never from a fixed example, so
    // it cannot promise a position somebody does not actually get.
    forResultBoardTitle: "📊 <b>ForResult — bugungi TOP</b>\n\n💰 Kim ko'p kiritsa — o'sha yuqorida!\n",
    forResultBoardEmpty:
      "📊 <b>ForResult — reklama taxtasi</b>\n\n" +
      "🎉 Taxta hozircha <b>bo'sh</b>!\n\n" +
      "Ya'ni birinchi bo'lib afishangizni qo'shsangiz, hech kim bilan raqobatlashmasdan " +
      "to'g'ridan-to'g'ri <b>🥇 1-o'rinni</b> egallaysiz.\n\n" +
      "Bunday imkoniyat uzoq turmaydi 👇",
    forResultEntry: (e) =>
      `${e.mark} <b>${e.place}-O'RIN</b>  ·  ${e.command}\n` +
      `📌 <b>${e.name}</b>\n` +
      `💬 <i>${e.about}</i>\n` +
      `${e.contactIcon} ${e.link}\n` +
      `💰 <b>${e.money}</b>\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈\n`,
    forResultBoardFooter: (page, pages, total) =>
      `━━━━━━━━━━━━━━\n📄 Sahifa <b>${page}</b> / ${pages}  ·  jami <b>${total}</b> ta afisha\n\n` +
      `👆 Batafsil ko'rish uchun afisha ustidagi <b>/ad_raqam</b> ga bosing`,
    forResultAddButton: "➕ O'z afishamni qo'shish",
    forResultInfoButton: "ℹ️ ForResult ma'lumotlari",
    forResultPrevButton: "⬅️ Orqaga",
    forResultNextButton: "➡️ Keyingisi",
    forResultBoardButton: "📊 Taxtaga qaytish",
    forResultOpenLinkButton: "🔗 Havolani ochish",
    forResultDetail: (e) =>
      `${e.mark} <b>${e.place}-o'rin</b>\n\n` +
      `📌 <b>${e.name}</b>\n\n` +
      `💬 ${e.about}\n\n` +
      `${e.contactIcon} ${e.link}\n` +
      `💰 Kiritilgan summa: <b>${e.money}</b>\n` +
      `🆔 <code>${e.id}</code>`,
    forResultAdGone:
      "🔍 Bunday afisha topilmadi.\n\nU o'chirilgan yoki raqam noto'g'ri bo'lishi mumkin.",
    forResultInfo:
      "📊 <b>ForResult nima?</b>\n\n" +
      "Bu — ochiq <b>reklama taxtasi</b>. Bu yerda har kim o'z o'rnini sotib olishi mumkin 💰\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>⚙️ Qanday ishlaydi?</b>\n\n" +
      "1️⃣ Afishangizni qo'shasiz — nomi, rasmi, havolasi va qisqacha ma'lumot\n" +
      "2️⃣ O'zingiz xohlagan summani kiritasiz — yuqori chegara yo'q\n" +
      "3️⃣ Summangiz qancha katta bo'lsa, o'rningiz shuncha yuqori bo'ladi\n\n" +
      "🥇 Eng ko'p to'lagan — <b>1-o'rinda</b>\n" +
      "🥈 Undan keyingisi — 2-o'rinda\n" +
      "🥉 Va hokazo, <b>TOP 50</b> gacha\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>🔥 Nega bu foydali?</b>\n\n" +
      "👀 TOP 50 ro'yxatni botimizning har bir foydalanuvchisi ko'radi\n" +
      "🔁 Har safar asosiy menyuga qaytganda afisha eslatib turiladi\n" +
      "📣 <b>Har kungi o'rinlar @foroneforever kanalimizda ham reklama qilib boriladi</b>\n" +
      "🔗 Havolangiz to'g'ridan-to'g'ri bosiladi — mijoz bir bosishda sizda\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>📈 O'rningizni ko'tarish</b>\n\n" +
      "Istalgan vaqtda yana to'lov qilsangiz, summangiz <b>ustiga qo'shiladi</b> " +
      "va shu zahoti yuqoriga chiqasiz. Ya'ni 1-o'rin doim ochiq — kim ko'proq " +
      "qadr qilsa, o'sha egallaydi.\n\n" +
      "💡 Biznes, blog, kanal, do'kon, xizmat — nima bo'lsa ham shu yerda ko'rinadi.\n\n" +
      "Hoziroq boshlang 👇\n\n" +
      "<i>📅 20-avgust kuni asos solindi · 21-avgust kuni soat 00:00 da ishga tushirildi</i>",
    forResultPromo:
      "🔥 <b>ForResult — bugun kim birinchi o'rinda?</b>\n\n" +
      "👀 Bugungi afishalar bilan tanishing yoki o'z afishangizni yuklang 🤭👇",
    forResultPromoButton: "📊 ForResult",
    forResultAskName:
      "📌 <b>1/5 — Afishangiz nomi</b>\n\n" +
      "Nomi nima bo'lsin?\n\n" +
      "Qisqa va yorqin bo'lsin — bu odamlar birinchi o'qiydigan narsa.\n\n" +
      "<i>Masalan: «Kofe Xona» yoki «Aziz Blog»</i>",
    forResultErrName: "⚠️ Nom 2 tadan 40 tagacha belgi bo'lishi kerak. Qaytadan yozing:",
    forResultAskPhoto:
      "🖼 <b>2/5 — Afishangiz rasmi</b>\n\n" +
      "Endi rasm yuboring.\n\n" +
      "Chiroyli va aniq rasm tanlang — taxtada eng ko'p e'tibor tortadigan narsa aynan shu.",
    forResultErrPhoto: "⚠️ Iltimos, <b>rasm</b> yuboring (fayl yoki matn emas).",
    forResultAskLink:
      "🔗 <b>3/5 — Aloqa</b>\n\n" +
      "Odam afishangizni bosganda qayerga borsin? Uchta usuldan birini tanlang:\n\n" +
      "1️⃣ <b>Havola</b> — https://instagram.com/sahifangiz\n" +
      "2️⃣ <b>Telegram</b> — @kanalingiz (kanal, guruh, bot yoki o'zingiz)\n" +
      "3️⃣ <b>Telefon raqam</b> — +998 90 123 45 67\n\n" +
      "Qaysi biri qulay bo'lsa, shuni yozing 👇",
    forResultErrLink:
      "⚠️ Buni tushunmadim. Uchta usuldan biri bo'lsin:\n\n" +
      "1️⃣ https://instagram.com/sahifangiz\n" +
      "2️⃣ @kanalingiz\n" +
      "3️⃣ +998901234567",
    forResultAskAbout:
      "💬 <b>4/5 — Qisqacha ma'lumot</b>\n\n" +
      "Afishangiz haqida qisqacha yozing — nima taklif qilasiz?\n\n" +
      "⚠️ Maksimal <b>100 ta belgi</b>. Qisqa va aniq bo'lgani yaxshiroq ishlaydi.",
    forResultErrAbout: "⚠️ Ma'lumot 5 tadan 100 tagacha belgi bo'lishi kerak. Qaytadan yozing:",
    forResultAskAmount: (e) =>
      "💰 <b>5/5 — Eng qiziq qismi!</b>\n\n" +
      "Qancha summa kiritmoqchisiz?\n\n" +
      (e.topMoney
        ? `📊 Hozir <b>🥇 1-o'rinda</b>: ${e.topMoney}\n` +
          `👉 Undan ko'p kiritsangiz, <b>siz 1-o'rinda</b> bo'lasiz!\n\n`
        : "🎉 Taxta hozircha bo'sh — istalgan summa bilan <b>🥇 1-o'rinni</b> egallaysiz!\n\n") +
      `Faqat raqam yozing (eng kami <b>${e.minMoney}</b>):`,
    forResultErrAmount: (e) =>
      `⚠️ Summa ${e.minMoney} dan ${e.maxMoney} gacha bo'lishi kerak.\n\nFaqat raqam yozing:`,
    forResultDraftReady: (e) =>
      "✅ <b>Afishangiz tayyor!</b>\n\n" +
      `📌 <b>${e.name}</b>\n` +
      `💬 ${e.about}\n` +
      `🔗 ${e.link}\n` +
      `💰 Summa: <b>${e.money}</b>\n\n` +
      "━━━━━━━━━━━━━━\n" +
      "To'lov amalga oshgach, afishangiz <b>shu zahoti</b> taxtada paydo bo'ladi 🚀",
    forResultPaidCongrats: (e) =>
      "🎉 <b>Tabriklaymiz! Afishangiz taxtada!</b>\n\n" +
      `${e.mark} Hozirgi o'rningiz: <b>${e.place}-o'rin</b>\n` +
      `💰 Jami kiritilgan: <b>${e.money}</b>\n\n` +
      "📣 Bugungi o'rinlar @foroneforever kanalimizda ham e'lon qilinadi.\n\n" +
      "💡 Yuqoriroq chiqmoqchimisiz? Yana to'lov qiling — summangiz ustiga qo'shiladi!",
    forResultCancelled: "❌ Bekor qilindi. Afisha qo'shilmadi.",
    forResultMyAdButton: "📌 Mening afisham",
    forResultTopUpButton: "💰 To'lov qo'shish",
    forResultEditButton: "✏️ Tahrirlash",
    forResultTop3Title: "👑 <b>BUGUNGI TOP 3</b>\n",
    forResultRestTitle: "📋 <b>Qolgan o'rinlar</b>\n",
    forResultNoAd:
      "📌 <b>Sizda hali afisha yo'q</b>\n\n" +
      "Bu yerda o'z biznesingiz, blogingiz yoki kanalingizni reklama qilishingiz mumkin.\n\n" +
      "💰 Qancha ko'p kiritsangiz — shuncha yuqorida turasiz.\n\n" +
      "Pastdagi «➕ Afisha qo'shish» tugmasidan boshlang 👇",
    forResultMyAdTitle: "📌 <b>Mening afisham</b>\n",
    forResultMyAdHidden:
      "\n🚫 <b>Bu afisha vaqtincha yashirilgan.</b>\nSabab haqida bilish uchun «🚨 Shikoyat» orqali bizga yozing.",
    forResultTopUpAsk: (e) =>
      "💰 <b>To'lov qo'shish</b>\n\n" +
      `📌 <b>${e.name}</b>\n` +
      `💰 Hozirgi summangiz: <b>${e.money}</b>\n` +
      `📊 Hozirgi o'rningiz: <b>${e.place}-o'rin</b>\n\n` +
      "━━━━━━━━━━━━━━\n" +
      e.gapsBlock +
      `\nQancha qo'shmoqchisiz? Faqat raqam yozing (eng kami <b>${e.minMoney}</b>):`,
    forResultGapLine: (e) => `${e.mark} <b>${e.place}-o'rin</b> uchun: <b>+${e.need}</b> yetmayapti`,
    forResultGapsHeader: "<b>Yuqoriga chiqish uchun:</b>\n",
    forResultAlreadyTop:
      "🥇 <b>Siz 1-o'rindasiz!</b>\n" +
      "Summangizni yana oshirsangiz, o'rningiz yanada mustahkamlanadi — " +
      "sizni ortda qoldirish qiyinlashadi.\n",
    forResultEditPick: "✏️ <b>Nimani o'zgartirmoqchisiz?</b>\n\nPastdan tanlang 👇",
    forResultEditNameButton: "📌 Nomi",
    forResultEditPhotoButton: "🖼 Rasmi",
    forResultEditLinkButton: "🔗 Havolasi",
    forResultEditAboutButton: "💬 Ma'lumoti",
    forResultEditSaved: "✅ <b>Saqlandi!</b> Afishangiz yangilandi.",
    forResultPickAdButton: "⚙️ Shu afishani boshqarish",
    forResultAdSelected: (name) => `⚙️ Tanlandi: <b>${name}</b>\n\nEndi pastdagi tugmalardan foydalaning 👇`,
    unexpectedError:
      "⚠️ Kutilmagan xatolik yuz berdi — amal bajarilmadi.\n\n" +
      "Iltimos, bir necha soniyadan so'ng qayta urinib ko'ring. Takrorlansa, «🚨 Shikoyat» orqali bizga yozing.",
    paymentProviderJoin: " yoki ",
    paymentDoneButton: "✅ To'lov qildim",
    paymentPendingNotice:
      "⏳ To'lov hali tasdiqlanmadi.\n\n" +
      "Agar hozirgina to'lagan bo'lsangiz, 1–2 daqiqa kuting va «✅ To'lov qildim» tugmasini yana bir bor bosing. " +
      "To'lov bankdan tasdiqlanishi bilan xizmat avtomatik ishga tushadi va sizga xabar keladi.\n\n" +
      "Agar to'lov qilmagan bo'lsangiz, yuqoridagi Click yoki Payme tugmasini bosing 👆",
    paymentConfirmedNotice: "✅ To'lovingiz tasdiqlangan — xizmat faol. Yoqimli foydalanish! 💛",
    unlockPaidOpenProfile:
      "🎉 <b>To'lov qabul qilindi!</b>\n\n" +
      "🔓 Bu insonning to'liq profili endi siz uchun ochiq.\n\n" +
      "👇 Profilga o'tish uchun pastdagi tugmani bosing.",
    unlockOpenProfileButton: "👤 Profilga o'tish",
    premiumActivated: (days) => `🎉 Premium faollashtirildi! ${days} kun davomida barcha imtiyozlardan foydalanasiz.`,
    // --- Premium tugashi haqida eslatmalar ---
    //
    // Bu xabarlar sotuvchidan emas, do'stdan kelgandek yozilgan. Odam bir
    // marta to'lagan — unga qayta reklama emas, oddiy eslatma kerak.
    premiumEnding7: (name) =>
      `👋 ${name ? `<b>${name}</b>, s` : "S"}alom!\n\n` +
      `💎 Premium muddatingiz tugashiga <b>bir hafta</b> qoldi ⏳\n\n` +
      `Shu vaqt ichida:\n` +
      `🔓 anketalarni cheksiz ochdingiz\n` +
      `🔥 profilingiz ko'proq ko'rsatildi\n` +
      `🕵️ anonim chatda jinsni tanlab suhbatlashdingiz\n\n` +
      `Nima deysiz — yana bittasini bosvoramizmi? 😄`,
    premiumEnding5: (name) =>
      `⏰ ${name ? `<b>${name}</b>, ` : ""}Premium tugashiga <b>5 kun</b> qoldi.\n\n` +
      `Shunchaki eslatib qo'ydim, xolos 🙂\n` +
      `Shoshilmang — hali vaqt bor 💛`,
    premiumEnding3: (name) =>
      `🔔 ${name ? `<b>${name}</b>, ` : ""}Premium tugashiga <b>3 kun</b> qoldi.\n\n` +
      `Agar yoqqan bo'lsa — yana bittasini ulab qo'yamizmi? 😊\n` +
      `⚡️ 5 daqiqagina vaqtingizni oladi, hammasi joyida davom etadi.`,
    premiumEnded: (name) =>
      `😔 ${name ? `<b>${name}</b>, ` : ""}Premium muddati tugadi.\n\n` +
      `Endi:\n` +
      `🔒 anketalar yopiq\n` +
      `📉 profilingiz kamroq ko'rsatiladi\n` +
      `🚫 anonim chatda jins tanlash yo'q\n\n` +
      `Lekin hammasi bir tugma narida — qaytaramizmi? 💛`,
    premiumRenewButton: "💎 Ha, yana bir oy",
    premiumRenewExpiredButton: "💎 Premiumni qaytarish",
    premiumPurchaseCongrats: (days) =>
      "🎉 <b>Tabriklaymiz! Premium faollashtirildi 💎</b>\n\n" +
      `📅 Amal qilish muddati: <b>${days} kun</b>\n\n` +
      "Endi sizda quyidagi imkoniyatlar bor:\n" +
      "🔓 <b>Har bir anketani cheksiz ochish</b> — alohida to'lovsiz\n" +
      "🔥 <b>Profilingiz ko'proq ko'rsatiladi</b> — ko'proq like va tanishuv\n" +
      "🕵️ <b>Anonim chatda jinsni tanlash</b> — 👧 yoki 👦, butun oy BEPUL\n" +
      "💛 <b>Sizni kim yoqtirganini ko'rish</b> — cheklovsiz\n" +
      "👑 <b>VIP guruhga kirish</b> — hozircha bepul (vaqtinchalik imtiyoz)\n\n" +
      "Boshlash uchun «💘 Yangi tanishuvlar» tugmasini bosing 👇",
    vipPurchaseCongrats: (link) =>
      "🎉 <b>Tabriklaymiz! VIP chatga kirish huquqi ochildi 👑</b>\n\n" +
      "Guruhda sizni nima kutmoqda:\n" +
      "💬 <b>Jonli suhbat</b> — yuzlab yigit va qizlar bilan\n" +
      "🎯 <b>Tanishuv o'yinlari</b> va faol muhokamalar\n" +
      "🛡 <b>Moderatsiya</b> — spam va noo'rin xabarlarsiz\n\n" +
      `🔗 Qo'shilish uchun havola:\n${link}`,
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
      "По возможности выберите чёткое фото, где хорошо видно ваше лицо 🙂\n\n" +
      "Анкеты без лица вызывают у других сомнения и получают меньше откликов — " +
      "открытое фото вызывает доверие и заметно повышает шансы на знакомство 💛",
    errMedia: "Пожалуйста, отправьте фото или видео:",
    askLocation:
      "📍 Откуда вы?\n\n" +
      "Напишите название вашего города или района — например: <b>Чиланзар</b>, <b>Мирабад</b>, " +
      "<b>Самарканд</b>, <b>Наманган</b>.\n\n" +
      "Или отправьте геолокацию через кнопку ниже 👇",
    locationButton: "📍 Отправить геолокацию",
    errLocation: "Пожалуйста, введите адрес текстом или отправьте геолокацию:",
    errLocationUnknown:
      "🤔 Не удалось найти такой город или район.\n\n" +
      "Пожалуйста, напишите настоящее название — например: <b>Чиланзар</b>, <b>Юнусабад</b>, " +
      "<b>Мирабад</b>, <b>Сергели</b>, <b>Самарканд</b>, <b>Бухара</b>, <b>Фергана</b>, <b>Наманган</b>.\n\n" +
      "Или проще всего — нажмите кнопку 📍 ниже, геолокация определится сама 👇",
    distanceNear: "рядом",
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
    welcomeAfterRegistration: (p) =>
      `🎉 Добро пожаловать в семью ForOne, ${p.name}!\n\n` +
      "💛 Новые знакомства, настоящая дружба и любовь — прямо здесь\n" +
      "🎁 Приглашайте друзей — получайте бесплатные подарки\n" +
      "🕵️ А если хотите — есть анонимный чат, о котором никто не узнает\n\n" +
      "Может, именно сегодня изменится ваша судьба 💍\n" +
      "Начните с меню внизу 👇",
    menu: {
      discover: "🔍 Новые знакомства",
      profile: "⚙️ Настройки анкеты",
      likes: "💌 Кому я понравился",
      vip: "👑 VIP чат",
      premium: "💎 Премиум",
      anonChat: "🕵️ Анонимный чат",
      complaint: "🚨 Хочу пожаловаться",
      referral: "🎁 Пригласить друга",
      forResult: "📊 ForResult — доска рекламы",
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
    vipIntro: (price) =>
      "👑 VIP Chat — что вас здесь ждёт?\n\n" +
      "🎉 Заведёте новых друзей\n" +
      "🎲 Сыграете в Мафию и отлично отдохнёте\n" +
      "💃 Познакомитесь с девушками, которых с каждым днём становится всё больше\n" +
      "💍 Если повезёт — найдёте свою вторую половинку прямо здесь!\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "⏳ <b>ПОЧЕМУ ИМЕННО СЕЙЧАС?</b>\n\n" +
      "Каждый день в группу приходят новые девушки. И чем больше девушек — " +
      "тем дороже вход 📈\n\n" +
      `Сегодняшняя цена — <b>${price} сум</b>. Это <b>самая низкая цена</b>, ` +
      "и такой она больше не будет.\n\n" +
      "🔥 Платите один раз — остаётесь <b>навсегда</b>. Кто придёт завтра, заплатит больше.\n" +
      "━━━━━━━━━━━━━━\n\n" +
      "💵 Цена:\n" +
      `👦 Для парней — <b>${price} сум</b> (пока что)\n` +
      "👧 Для девушек — 🆓 Совершенно бесплатно\n\n" +
      "💎 <b>Если у вас есть Premium — группа пока БЕСПЛАТНА для вас.</b> " +
      "Но это временно: по мере наполнения группы VIP станет отдельной платной услугой.\n\n" +
      "😉 Обещаю — скучать здесь не придётся!",
    vipPayButton: "💳 Хочу оплатить",
    vipJoinFreeButton: "🔗 Присоединиться бесплатно",
    vipPayIntro: "💳 Нажмите кнопку ниже, чтобы оплатить:",
    vipJoinMessage: (link) => `🎉 Добро пожаловать! Ссылка для вступления в группу:\n${link}`,
    vipPremiumBonusMessage: (link) =>
      `👑 <b>Как обладателю Premium, VIP-группа для вас БЕСПЛАТНА!</b>\n\n` +
      `🔗 Ссылка для вступления:\n${link}\n\n` +
      `⏳ <i>Внимание: это временная привилегия. Группа пока новая — по мере роста ` +
      `числа участников вход в VIP-группу станет отдельной платной услугой и перестанет ` +
      `входить в Premium. Те, кто вступил сейчас, останутся в группе.</i>`,
    vipJoinRequestMessage: (link) =>
      `🎉 Ссылка для вступления в группу:\n${link}\n\n` +
      `📩 При переходе по ссылке отправится заявка — вы попадёте в группу, как только администратор её одобрит. ` +
      `Обычно это быстро, немного подождите 💛`,
    discoverNoCandidates:
      "🌱 Вы просмотрели все подходящие анкеты!\n\n" +
      "ForOne — молодой проект, мы работаем совсем недавно, поэтому анкеты пока закончились. " +
      "Но каждый день добавляются новые люди, и скоро вас ждут новые знакомства 💛\n\n" +
      "А пока:\n" +
      "🎁 Пригласите друзей — за каждые 3 друзей вы получаете 1 бесплатное открытие анкеты\n" +
      "👑 Попробуйте другие функции (Premium, VIP чат)\n\n" +
      "Поделитесь ботом с друзьями — они тоже найдут свою любовь, а вы получите приз! 🏆",
    discoverTemporaryProblem: "Произошёл временный сбой. Пожалуйста, попробуйте чуть позже 🙏",
    unlockLinkText: "🔐 Получить доступ к анкете полностью",
    unlockPremiumButton: "👑 Подключить Premium",
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
    matchedToast: "🎉 Это совпадение!",
    matchNotificationLocked: (name) =>
      `🎉 <b>У вас совпадение с ${name}!</b>\n\n` +
      `${name} получил(а) ваши контакты — может написать вам первым.\n\n` +
      "Если вы тоже хотите открыть анкету, выберите ниже 👇",
    matchNotification: (name) =>
      `🎉 <b>У вас взаимная симпатия с ${name}!</b>\n\n` +
      `💬 Теперь ход за вами: <b>${name}</b> ждёт вашего сообщения. ` +
      `Контакт есть только у вас — поэтому первым пишете вы 😊`,
    unlockSuccessNoContact: "✅ Оплата получена, но, к сожалению, эта анкета уже удалена. 😔",
    profileUnavailable:
      "😔 Этой анкеты больше нет — владелец удалил или закрыл её.\n" +
      "Ваше бесплатное открытие сохранено, потратите его на другую.",
    noLikesYet: "😔 Пока никто не поставил вам лайк.\nСкоро их станет больше! 🚀✨",
    likesIntro: (count) => `💌 Вам поставили лайк ${count} человек! 😍\n\nПосмотрим по очереди 👇`,
    likesNextButton: (position, total) => `➡️ Следующий (${position}/${total})`,
    likesAllSeen:
      "✅ Вы просмотрели всех, кто поставил вам лайк!\n\n" +
      "Как только появятся новые — сообщим 💌",
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
      "🕵️ Возможность выбирать пол собеседника в анонимном чате — БЕСПЛАТНО весь месяц! (обычно 12 900 сум/неделя)\n" +
      "👑 Вход в VIP-группу — пока БЕСПЛАТНО (обычно 21 900 сум)\n\n" +
      "⏳ Привилегия на VIP-группу временная: по мере наполнения группы она станет отдельной платной услугой.\n\n" +
      "💵 Цена: 79 900 сум / 1 месяц",
    // --- Канал ForOne ---
    channelGateText:
      "📣 <b>Официальный канал ForOne</b>\n\n" +
      "Прежде чем продолжить, подпишитесь на наш канал 💛\n\n" +
      "Что вас там ждёт:\n" +
      "🎁 Подарки и бесплатные возможности только для подписчиков\n" +
      "✨ Новые функции — вы узнаете первыми\n" +
      "💡 Советы, которые реально работают в знакомствах\n" +
      "🏆 Конкурсы и призы\n\n" +
      "Подпишитесь и нажмите кнопку ниже 👇",
    channelJoinButton: "📣 Подписаться на канал",
    channelCheckButton: "✅ Я подписался",
    channelJoinedToast: "✅ Спасибо! Продолжаем 💛",
    channelNotJoinedToast: "❌ Подписка не найдена.\n\nСначала зайдите в канал и нажмите \"Подписаться\", затем проверьте снова.",
    channelWelcomeInvite:
      "📣 <b>Присоединяйтесь к нашему каналу!</b>\n\n" +
      "В канале ForOne вас ждёт:\n" +
      "🎁 Подарки для подписчиков\n" +
      "✨ Первыми узнаете о новых функциях\n" +
      "💡 Советы, которые реально работают\n\n" +
      "Одна кнопка — и вы ничего не пропустите 👇",
    payButtonGeneric: "💳 Оплатить",
    paymentsNotConfigured:
      "💳 Приём оплаты ещё не настроен (ожидаются Click и Payme).\n\nСкоро заработает! 🚧",
    qrCaptionFor: (provider) => `📷 Отсканируйте QR-код и оплатите через ${provider}`,
    payWith_click: "💳 Оплатить через Click",
    payWith_payme: "💳 Оплатить через Payme",
    paymentHowToNote: (providers) =>
      "━━━━━━━━━━━━━━\n" +
      `1️⃣ Нажмите кнопку ${providers}\n` +
      "2️⃣ Совершите оплату\n" +
      "3️⃣ Затем нажмите «✅ Я оплатил»\n\n" +
      "⏳ После подтверждения оплаты функция включится за несколько секунд.",
    paymentAdminHelpNote: "(Если у вас нет Click — это не проблема 😊 обратитесь к нашему админу @ForOnebest)",
    // --- ForResult: the paid advertising board ---------------------------
    forResultBoardTitle: "📊 <b>ForResult — ТОП дня</b>\n\n💰 Кто вложил больше — тот выше!\n",
    forResultBoardEmpty:
      "📊 <b>ForResult — доска рекламы</b>\n\n" +
      "🎉 Доска пока <b>пуста</b>!\n\n" +
      "То есть если вы добавите объявление первым, то займёте <b>🥇 1-е место</b> " +
      "без всякой конкуренции.\n\n" +
      "Такая возможность держится недолго 👇",
    forResultEntry: (e) =>
      `${e.mark} <b>${e.place}-Е МЕСТО</b>  ·  ${e.command}\n` +
      `📌 <b>${e.name}</b>\n` +
      `💬 <i>${e.about}</i>\n` +
      `${e.contactIcon} ${e.link}\n` +
      `💰 <b>${e.money}</b>\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈\n`,
    forResultBoardFooter: (page, pages, total) =>
      `━━━━━━━━━━━━━━\n📄 Страница <b>${page}</b> / ${pages}  ·  всего <b>${total}</b> объявлений\n\n` +
      `👆 Чтобы посмотреть подробнее, нажмите на <b>/ad_номер</b> над объявлением`,
    forResultAddButton: "➕ Добавить своё объявление",
    forResultInfoButton: "ℹ️ О ForResult",
    forResultPrevButton: "⬅️ Назад",
    forResultNextButton: "➡️ Далее",
    forResultBoardButton: "📊 Вернуться к доске",
    forResultOpenLinkButton: "🔗 Открыть ссылку",
    forResultDetail: (e) =>
      `${e.mark} <b>${e.place}-е место</b>\n\n` +
      `📌 <b>${e.name}</b>\n\n` +
      `💬 ${e.about}\n\n` +
      `${e.contactIcon} ${e.link}\n` +
      `💰 Вложено: <b>${e.money}</b>\n` +
      `🆔 <code>${e.id}</code>`,
    forResultAdGone:
      "🔍 Такое объявление не найдено.\n\nВозможно, оно удалено или номер указан неверно.",
    forResultInfo:
      "📊 <b>Что такое ForResult?</b>\n\n" +
      "Это открытая <b>доска рекламы</b>. Здесь каждый может купить своё место 💰\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>⚙️ Как это работает?</b>\n\n" +
      "1️⃣ Вы добавляете объявление — название, фото, ссылку и краткое описание\n" +
      "2️⃣ Вводите любую сумму — верхнего предела нет\n" +
      "3️⃣ Чем больше сумма, тем выше ваше место\n\n" +
      "🥇 Кто заплатил больше всех — <b>на 1-м месте</b>\n" +
      "🥈 Следующий — на 2-м\n" +
      "🥉 И так далее, до <b>ТОП 50</b>\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>🔥 Почему это выгодно?</b>\n\n" +
      "👀 Список ТОП 50 видит каждый пользователь нашего бота\n" +
      "🔁 Каждый раз при возврате в главное меню о доске напоминают\n" +
      "📣 <b>Места дня дополнительно рекламируются в нашем канале @foroneforever</b>\n" +
      "🔗 Ваша ссылка кликабельна — клиент у вас в одно нажатие\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>📈 Поднять своё место</b>\n\n" +
      "Заплатите ещё в любой момент — сумма <b>прибавится к вашей</b>, " +
      "и вы сразу подниметесь выше. То есть 1-е место всегда открыто: " +
      "его занимает тот, кто ценит его больше.\n\n" +
      "💡 Бизнес, блог, канал, магазин, услуга — что угодно будет видно здесь.\n\n" +
      "Начните прямо сейчас 👇\n\n" +
      "<i>📅 Основан 20 августа · запущен 21 августа в 00:00</i>",
    forResultPromo:
      "🔥 <b>ForResult — кто сегодня на первом месте?</b>\n\n" +
      "👀 Посмотрите сегодняшние объявления или разместите своё 🤭👇",
    forResultPromoButton: "📊 ForResult",
    forResultAskName:
      "📌 <b>1/5 — Название объявления</b>\n\n" +
      "Как назовём?\n\n" +
      "Пусть будет коротко и ярко — это первое, что прочитают люди.\n\n" +
      "<i>Например: «Кофейня» или «Блог Азиза»</i>",
    forResultErrName: "⚠️ Название должно быть от 2 до 40 символов. Напишите ещё раз:",
    forResultAskPhoto:
      "🖼 <b>2/5 — Фото объявления</b>\n\n" +
      "Теперь отправьте фото.\n\n" +
      "Выберите красивое и чёткое — именно оно привлекает больше всего внимания на доске.",
    forResultErrPhoto: "⚠️ Пожалуйста, отправьте <b>фото</b> (не файл и не текст).",
    forResultAskLink:
      "🔗 <b>3/5 — Контакт</b>\n\n" +
      "Куда попадёт человек, нажав на объявление? Выберите один из трёх способов:\n\n" +
      "1️⃣ <b>Ссылка</b> — https://instagram.com/ваша_страница\n" +
      "2️⃣ <b>Telegram</b> — @ваш_канал (канал, группа, бот или вы сами)\n" +
      "3️⃣ <b>Номер телефона</b> — +998 90 123 45 67\n\n" +
      "Напишите то, что вам удобнее 👇",
    forResultErrLink:
      "⚠️ Не понял. Нужен один из трёх вариантов:\n\n" +
      "1️⃣ https://instagram.com/ваша_страница\n" +
      "2️⃣ @ваш_канал\n" +
      "3️⃣ +998901234567",
    forResultAskAbout:
      "💬 <b>4/5 — Краткое описание</b>\n\n" +
      "Напишите коротко — что вы предлагаете?\n\n" +
      "⚠️ Максимум <b>100 символов</b>. Коротко и по делу работает лучше.",
    forResultErrAbout: "⚠️ Описание должно быть от 5 до 100 символов. Напишите ещё раз:",
    forResultAskAmount: (e) =>
      "💰 <b>5/5 — Самое интересное!</b>\n\n" +
      "Какую сумму хотите вложить?\n\n" +
      (e.topMoney
        ? `📊 Сейчас на <b>🥇 1-м месте</b>: ${e.topMoney}\n` +
          `👉 Вложите больше — и <b>1-е место ваше</b>!\n\n`
        : "🎉 Доска пока пуста — с любой суммой вы займёте <b>🥇 1-е место</b>!\n\n") +
      `Напишите только число (минимум <b>${e.minMoney}</b>):`,
    forResultErrAmount: (e) =>
      `⚠️ Сумма должна быть от ${e.minMoney} до ${e.maxMoney}.\n\nНапишите только число:`,
    forResultDraftReady: (e) =>
      "✅ <b>Ваше объявление готово!</b>\n\n" +
      `📌 <b>${e.name}</b>\n` +
      `💬 ${e.about}\n` +
      `🔗 ${e.link}\n` +
      `💰 Сумма: <b>${e.money}</b>\n\n` +
      "━━━━━━━━━━━━━━\n" +
      "После оплаты объявление появится на доске <b>сразу же</b> 🚀",
    forResultPaidCongrats: (e) =>
      "🎉 <b>Поздравляем! Ваше объявление на доске!</b>\n\n" +
      `${e.mark} Ваше место сейчас: <b>${e.place}-е</b>\n` +
      `💰 Всего вложено: <b>${e.money}</b>\n\n` +
      "📣 Места дня также объявляются в нашем канале @foroneforever.\n\n" +
      "💡 Хотите выше? Заплатите ещё — сумма прибавится к вашей!",
    forResultCancelled: "❌ Отменено. Объявление не добавлено.",
    forResultMyAdButton: "📌 Моё объявление",
    forResultTopUpButton: "💰 Добавить оплату",
    forResultEditButton: "✏️ Редактировать",
    forResultTop3Title: "👑 <b>ТОП 3 СЕГОДНЯ</b>\n",
    forResultRestTitle: "📋 <b>Остальные места</b>\n",
    forResultNoAd:
      "📌 <b>У вас пока нет объявления</b>\n\n" +
      "Здесь вы можете прорекламировать свой бизнес, блог или канал.\n\n" +
      "💰 Чем больше вложите — тем выше будете.\n\n" +
      "Начните с кнопки «➕ Добавить объявление» внизу 👇",
    forResultMyAdTitle: "📌 <b>Моё объявление</b>\n",
    forResultMyAdHidden:
      "\n🚫 <b>Это объявление временно скрыто.</b>\nЧтобы узнать причину, напишите нам через «🚨 Жалоба».",
    forResultTopUpAsk: (e) =>
      "💰 <b>Добавить оплату</b>\n\n" +
      `📌 <b>${e.name}</b>\n` +
      `💰 Ваша сумма сейчас: <b>${e.money}</b>\n` +
      `📊 Ваше место сейчас: <b>${e.place}-е</b>\n\n` +
      "━━━━━━━━━━━━━━\n" +
      e.gapsBlock +
      `\nСколько хотите добавить? Напишите только число (минимум <b>${e.minMoney}</b>):`,
    forResultGapLine: (e) => `${e.mark} До <b>${e.place}-го места</b>: не хватает <b>+${e.need}</b>`,
    forResultGapsHeader: "<b>Чтобы подняться выше:</b>\n",
    forResultAlreadyTop:
      "🥇 <b>Вы на 1-м месте!</b>\n" +
      "Увеличьте сумму — и ваше место станет ещё крепче, обойти вас будет труднее.\n",
    forResultEditPick: "✏️ <b>Что хотите изменить?</b>\n\nВыберите ниже 👇",
    forResultEditNameButton: "📌 Название",
    forResultEditPhotoButton: "🖼 Фото",
    forResultEditLinkButton: "🔗 Ссылка",
    forResultEditAboutButton: "💬 Описание",
    forResultEditSaved: "✅ <b>Сохранено!</b> Объявление обновлено.",
    forResultPickAdButton: "⚙️ Управлять этим объявлением",
    forResultAdSelected: (name) => `⚙️ Выбрано: <b>${name}</b>\n\nТеперь используйте кнопки внизу 👇`,
    unexpectedError:
      "⚠️ Произошла непредвиденная ошибка — действие не выполнено.\n\n" +
      "Попробуйте ещё раз через несколько секунд. Если повторится, напишите нам через «🚨 Жалоба».",
    paymentProviderJoin: " или ",
    paymentDoneButton: "✅ Я оплатил",
    paymentPendingNotice:
      "⏳ Оплата пока не подтверждена.\n\n" +
      "Если вы только что оплатили, подождите 1–2 минуты и нажмите «✅ Я оплатил» ещё раз. " +
      "Как только банк подтвердит платёж, услуга включится автоматически и вы получите уведомление.\n\n" +
      "Если вы ещё не оплатили — нажмите кнопку Click или Payme выше 👆",
    paymentConfirmedNotice: "✅ Ваша оплата подтверждена — услуга активна. Приятного пользования! 💛",
    unlockPaidOpenProfile:
      "🎉 <b>Оплата получена!</b>\n\n" +
      "🔓 Полный профиль этого человека теперь открыт для вас.\n\n" +
      "👇 Нажмите кнопку ниже, чтобы перейти к профилю.",
    unlockOpenProfileButton: "👤 Перейти к профилю",
    premiumActivated: (days) => `🎉 Премиум активирован! Все привилегии доступны в течение ${days} дней.`,
    premiumEnding7: (name) =>
      `👋 ${name ? `<b>${name}</b>, п` : "П"}ривет!\n\n` +
      `💎 До конца вашего Premium осталась <b>неделя</b> ⏳\n\n` +
      `За это время вы:\n` +
      `🔓 открывали анкеты без ограничений\n` +
      `🔥 показывались другим чаще\n` +
      `🕵️ выбирали пол собеседника в анонимном чате\n\n` +
      `Ну что, продлим ещё на месяц? 😄`,
    premiumEnding5: (name) =>
      `⏰ ${name ? `<b>${name}</b>, д` : "Д"}о конца Premium — <b>5 дней</b>.\n\n` +
      `Просто напоминаю, не более 🙂\n` +
      `Не спешите — время ещё есть 💛`,
    premiumEnding3: (name) =>
      `🔔 ${name ? `<b>${name}</b>, д` : "Д"}о конца Premium — <b>3 дня</b>.\n\n` +
      `Если понравилось — продлим? 😊\n` +
      `⚡️ Займёт минут пять, и всё продолжится как было.`,
    premiumEnded: (name) =>
      `😔 ${name ? `<b>${name}</b>, в` : "В"}аш Premium закончился.\n\n` +
      `Теперь:\n` +
      `🔒 анкеты снова закрыты\n` +
      `📉 профиль показывается реже\n` +
      `🚫 выбор пола в анонимном чате недоступен\n\n` +
      `Но всё это в одном нажатии — вернём? 💛`,
    premiumRenewButton: "💎 Да, ещё на месяц",
    premiumRenewExpiredButton: "💎 Вернуть Premium",
    premiumPurchaseCongrats: (days) =>
      "🎉 <b>Поздравляем! Премиум активирован 💎</b>\n\n" +
      `📅 Срок действия: <b>${days} дней</b>\n\n` +
      "Теперь вам доступно:\n" +
      "🔓 <b>Безлимитное открытие анкет</b> — без отдельной оплаты\n" +
      "🔥 <b>Ваш профиль показывается чаще</b> — больше лайков и знакомств\n" +
      "🕵️ <b>Выбор пола в анонимном чате</b> — 👧 или 👦, весь месяц БЕСПЛАТНО\n" +
      "💛 <b>Кто вас лайкнул</b> — без ограничений\n" +
      "👑 <b>Вход в VIP-группу</b> — пока бесплатно (временная привилегия)\n\n" +
      "Нажмите «💘 Новые знакомства», чтобы начать 👇",
    vipPurchaseCongrats: (link) =>
      "🎉 <b>Поздравляем! Доступ в VIP-чат открыт 👑</b>\n\n" +
      "Что вас ждёт в группе:\n" +
      "💬 <b>Живое общение</b> — сотни парней и девушек\n" +
      "🎯 <b>Игры для знакомств</b> и активные обсуждения\n" +
      "🛡 <b>Модерация</b> — без спама и неуместных сообщений\n\n" +
      `🔗 Ссылка для вступления:\n${link}`,
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
      "If you can, pick a clear photo where your face is easy to see 🙂\n\n" +
      "Profiles without a visible face make people hesitate and get fewer replies — " +
      "an open photo builds trust and noticeably improves your chances 💛",
    errMedia: "Please send a photo or video:",
    askLocation:
      "📍 Where are you from?\n\n" +
      "Type your city or district — for example: <b>Chilonzor</b>, <b>Mirobod</b>, " +
      "<b>Samarqand</b>, <b>Namangan</b>.\n\n" +
      "Or share your location with the button below 👇",
    locationButton: "📍 Send location",
    errLocation: "Please enter your location as text or share it:",
    errLocationUnknown:
      "🤔 I couldn't find that city or district.\n\n" +
      "Please type a real name — for example: <b>Chilonzor</b>, <b>Yunusobod</b>, <b>Mirobod</b>, " +
      "<b>Sergeli</b>, <b>Samarqand</b>, <b>Buxoro</b>, <b>Farg'ona</b>, <b>Namangan</b>.\n\n" +
      "Or easiest of all — tap the 📍 button below and your location is detected for you 👇",
    distanceNear: "nearby",
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
    welcomeAfterRegistration: (p) =>
      `🎉 Welcome to the ForOne family, ${p.name}!\n\n` +
      "💛 New people, real friendships and love — right here\n" +
      "🎁 Invite friends — get free rewards\n" +
      "🕵️ Want more mystery? There's an anonymous chat too\n\n" +
      "Maybe today is the day everything changes 💍\n" +
      "Start from the menu below 👇",
    menu: {
      discover: "🔍 New matches",
      profile: "⚙️ Profile settings",
      likes: "💌 Who liked me",
      vip: "👑 VIP chat",
      premium: "💎 Premium",
      anonChat: "🕵️ Anonymous chat",
      complaint: "🚨 I want to report",
      referral: "🎁 Invite a friend",
      forResult: "📊 ForResult — ad board",
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
    vipIntro: (price) =>
      "👑 VIP Chat — what's waiting for you here?\n\n" +
      "🎉 Make new friends\n" +
      "🎲 Play Mafia and have a great time\n" +
      "💃 Meet girls — and there are more of them every day\n" +
      "💍 If you're lucky, you might just find your other half right here!\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "⏳ <b>WHY RIGHT NOW?</b>\n\n" +
      "New girls join the group every day. And the more girls there are, " +
      "the higher the entry price goes 📈\n\n" +
      `Today's price — <b>${price} UZS</b>. This is the <b>lowest it will ever be</b>.\n\n` +
      "🔥 Pay once, stay <b>forever</b>. Whoever joins tomorrow pays more.\n" +
      "━━━━━━━━━━━━━━\n\n" +
      "💵 Price:\n" +
      `👦 For guys — <b>${price} UZS</b> (for now)\n` +
      "👧 For girls — 🆓 Completely free\n\n" +
      "💎 <b>If you have Premium, the group is free for you right now.</b> " +
      "But only for now: as the group fills up, VIP becomes a paid extra.\n\n" +
      "😉 I promise — you won't be bored here!",
    vipPayButton: "💳 I want to pay",
    vipJoinFreeButton: "🔗 Join for free",
    vipPayIntro: "💳 Tap the button below to pay:",
    vipJoinMessage: (link) => `🎉 Welcome! Here's the link to join the group:\n${link}`,
    vipPremiumBonusMessage: (link) =>
      `👑 <b>As a Premium member, the VIP group is FREE for you!</b>\n\n` +
      `🔗 Here's your link:\n${link}\n\n` +
      `⏳ <i>Heads up: this is a temporary perk. The group is new — as it fills up, ` +
      `VIP access becomes a paid extra and stops being part of Premium. ` +
      `Anyone who joins now stays in.</i>`,
    vipJoinRequestMessage: (link) =>
      `🎉 Here's the link to join the group:\n${link}\n\n` +
      `📩 Tapping it sends a request — you'll be in as soon as an admin approves it. ` +
      `That's usually quick, so hang tight 💛`,
    discoverNoCandidates:
      "🌱 You've seen everyone who matches right now!\n\n" +
      "ForOne is still a young project -- we haven't been open long, so profiles have run out for the moment. " +
      "New people join every day, and fresh matches are coming soon 💛\n\n" +
      "In the meantime:\n" +
      "🎁 Invite your friends -- every 3 friends earns you 1 free profile unlock\n" +
      "👑 Try other features (Premium, VIP chat)\n\n" +
      "Share the bot with friends -- they might find love too, and you win a prize! 🏆",
    discoverTemporaryProblem: "Something went wrong for a moment. Please try again shortly 🙏",
    unlockLinkText: "🔐 Get full access to this profile",
    unlockPremiumButton: "👑 Get Premium",
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
    matchedToast: "🎉 It's a match!",
    matchNotificationLocked: (name) =>
      `🎉 <b>It's a match with ${name}!</b>\n\n` +
      `${name} has your contact and can write to you first.\n\n` +
      "If you want to open their profile too, pick below 👇",
    matchNotification: (name) =>
      `🎉 <b>You and ${name} matched!</b>\n\n` +
      `💬 Your move: <b>${name}</b> is waiting to hear from you. ` +
      `You're the one holding their contact, so you write first 😊`,
    unlockSuccessNoContact: "✅ Payment received, but unfortunately this profile has already been removed. 😔",
    profileUnavailable:
      "😔 This profile is gone -- the owner deleted or closed it.\n" +
      "Your free unlock is untouched; spend it on someone else.",
    noLikesYet: "😔 No one has liked you yet.\nMore is coming soon! 🚀✨",
    likesIntro: (count) => `💌 ${count} people liked you! 😍\n\nLet's go through them one by one 👇`,
    likesNextButton: (position, total) => `➡️ Next (${position}/${total})`,
    likesAllSeen:
      "✅ You've been through everyone who liked you!\n\n" +
      "We'll let you know as soon as someone new comes along 💌",
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
      "🕵️ Choose either gender to chat with in Anonymous chat — FREE for the whole month! (normally 12,900 UZS/week)\n" +
      "👑 VIP group access — free for now (normally 21,900 UZS)\n\n" +
      "⏳ The VIP group perk is temporary: as the group fills up it becomes a paid extra.\n\n" +
      "💵 Price: 79,900 UZS / month",
    // --- ForOne channel ---
    channelGateText:
      "📣 <b>The official ForOne channel</b>\n\n" +
      "Before you continue, join our channel 💛\n\n" +
      "What's waiting there:\n" +
      "🎁 Gifts and free perks for subscribers only\n" +
      "✨ New features — you'll hear first\n" +
      "💡 Dating advice that actually works\n" +
      "🏆 Contests and prizes\n\n" +
      "Join, then tap the button below 👇",
    channelJoinButton: "📣 Join the channel",
    channelCheckButton: "✅ I subscribed",
    channelJoinedToast: "✅ Thank you! Let's continue 💛",
    channelNotJoinedToast: "❌ Subscription not found.\n\nOpen the channel, tap \"Join\", then check again.",
    channelWelcomeInvite:
      "📣 <b>Join our channel!</b>\n\n" +
      "Waiting for you on the ForOne channel:\n" +
      "🎁 Gifts for subscribers\n" +
      "✨ Be the first to hear about new features\n" +
      "💡 Dating advice that actually works\n\n" +
      "One tap and you won't miss a thing 👇",
    payButtonGeneric: "💳 Pay",
    paymentsNotConfigured:
      "💳 Payments aren't set up yet (waiting on Click and Payme).\n\nComing soon! 🚧",
    qrCaptionFor: (provider) => `📷 Scan the QR code and pay with ${provider}`,
    payWith_click: "💳 Pay with Click",
    payWith_payme: "💳 Pay with Payme",
    paymentHowToNote: (providers) =>
      "━━━━━━━━━━━━━━\n" +
      `1️⃣ Tap the ${providers} button\n` +
      "2️⃣ Complete the payment\n" +
      "3️⃣ Then tap “✅ I have paid”\n\n" +
      "⏳ Once the payment is confirmed, the feature turns on within seconds.",
    paymentAdminHelpNote: "(No Click? No problem 😊 message our admin @ForOnebest)",
    // --- ForResult: the paid advertising board ---------------------------
    forResultBoardTitle: "📊 <b>ForResult — today's TOP</b>\n\n💰 The more you put in, the higher you sit!\n",
    forResultBoardEmpty:
      "📊 <b>ForResult — the ad board</b>\n\n" +
      "🎉 The board is <b>empty</b> right now!\n\n" +
      "Which means if you add the first ad, you take <b>🥇 1st place</b> " +
      "with nobody to outbid.\n\n" +
      "That window doesn't stay open long 👇",
    forResultEntry: (e) =>
      `${e.mark} <b>#${e.place}</b>  ·  ${e.command}\n` +
      `📌 <b>${e.name}</b>\n` +
      `💬 <i>${e.about}</i>\n` +
      `${e.contactIcon} ${e.link}\n` +
      `💰 <b>${e.money}</b>\n` +
      `┈┈┈┈┈┈┈┈┈┈┈┈\n`,
    forResultBoardFooter: (page, pages, total) =>
      `━━━━━━━━━━━━━━\n📄 Page <b>${page}</b> / ${pages}  ·  <b>${total}</b> ads in total\n\n` +
      `👆 Tap the <b>/ad_number</b> above an ad to see it in full`,
    forResultAddButton: "➕ Add my ad",
    forResultInfoButton: "ℹ️ About ForResult",
    forResultPrevButton: "⬅️ Back",
    forResultNextButton: "➡️ Next",
    forResultBoardButton: "📊 Back to the board",
    forResultOpenLinkButton: "🔗 Open the link",
    forResultDetail: (e) =>
      `${e.mark} <b>#${e.place}</b>\n\n` +
      `📌 <b>${e.name}</b>\n\n` +
      `💬 ${e.about}\n\n` +
      `${e.contactIcon} ${e.link}\n` +
      `💰 Paid in: <b>${e.money}</b>\n` +
      `🆔 <code>${e.id}</code>`,
    forResultAdGone: "🔍 No such ad.\n\nIt may have been removed, or the number is wrong.",
    forResultInfo:
      "📊 <b>What is ForResult?</b>\n\n" +
      "An open <b>ad board</b>. Anyone can buy their place on it 💰\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>⚙️ How it works</b>\n\n" +
      "1️⃣ You add your ad — a name, a photo, a link and a short description\n" +
      "2️⃣ You name the amount — there is no upper limit\n" +
      "3️⃣ The bigger the amount, the higher your place\n\n" +
      "🥇 Whoever paid the most sits at <b>#1</b>\n" +
      "🥈 Next one at #2\n" +
      "🥉 And so on, all the way to the <b>TOP 50</b>\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>🔥 Why it's worth it</b>\n\n" +
      "👀 Every user of this bot sees the TOP 50\n" +
      "🔁 The board is put in front of them again on every return to the main menu\n" +
      "📣 <b>Each day's places are also advertised in our @foroneforever channel</b>\n" +
      "🔗 Your link is one tap away — a customer reaches you immediately\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "<b>📈 Moving up</b>\n\n" +
      "Pay again whenever you like and the amount is <b>added on top of yours</b>, " +
      "moving you up straight away. #1 is always open — it belongs to whoever " +
      "values it most.\n\n" +
      "💡 A business, a blog, a channel, a shop, a service — whatever it is, it shows here.\n\n" +
      "Start right now 👇\n\n" +
      "<i>📅 Founded 20 August · launched 21 August at 00:00</i>",
    forResultPromo:
      "🔥 <b>ForResult — who's number one today?</b>\n\n" +
      "👀 Have a look at today's ads, or put yours up 🤭👇",
    forResultPromoButton: "📊 ForResult",
    forResultAskName:
      "📌 <b>1/5 — Your ad's name</b>\n\n" +
      "What should it be called?\n\n" +
      "Keep it short and bright — it's the first thing people read.\n\n" +
      "<i>For example: \"Coffee House\" or \"Aziz's Blog\"</i>",
    forResultErrName: "⚠️ The name must be 2 to 40 characters. Try again:",
    forResultAskPhoto:
      "🖼 <b>2/5 — Your ad's photo</b>\n\n" +
      "Now send a photo.\n\n" +
      "Pick a sharp, good-looking one — it's what draws the most attention on the board.",
    forResultErrPhoto: "⚠️ Please send a <b>photo</b> (not a file, not text).",
    forResultAskLink:
      "🔗 <b>3/5 — Contact</b>\n\n" +
      "Where should someone land when they tap your ad? Any of three will do:\n\n" +
      "1️⃣ <b>A link</b> — https://instagram.com/your_page\n" +
      "2️⃣ <b>Telegram</b> — @your_channel (a channel, group, bot, or you)\n" +
      "3️⃣ <b>A phone number</b> — +998 90 123 45 67\n\n" +
      "Send whichever suits you 👇",
    forResultErrLink:
      "⚠️ I didn't understand that. It needs to be one of three:\n\n" +
      "1️⃣ https://instagram.com/your_page\n" +
      "2️⃣ @your_channel\n" +
      "3️⃣ +998901234567",
    forResultAskAbout:
      "💬 <b>4/5 — Short description</b>\n\n" +
      "In a line or two — what are you offering?\n\n" +
      "⚠️ <b>100 characters</b> maximum. Short and specific works better.",
    forResultErrAbout: "⚠️ The description must be 5 to 100 characters. Try again:",
    forResultAskAmount: (e) =>
      "💰 <b>5/5 — the interesting part!</b>\n\n" +
      "How much would you like to put in?\n\n" +
      (e.topMoney
        ? `📊 <b>🥇 1st place</b> currently sits at: ${e.topMoney}\n` +
          `👉 Put in more and <b>#1 is yours</b>!\n\n`
        : "🎉 The board is empty — any amount takes <b>🥇 1st place</b>!\n\n") +
      `Send the number only (minimum <b>${e.minMoney}</b>):`,
    forResultErrAmount: (e) =>
      `⚠️ The amount must be between ${e.minMoney} and ${e.maxMoney}.\n\nSend the number only:`,
    forResultDraftReady: (e) =>
      "✅ <b>Your ad is ready!</b>\n\n" +
      `📌 <b>${e.name}</b>\n` +
      `💬 ${e.about}\n` +
      `🔗 ${e.link}\n` +
      `💰 Amount: <b>${e.money}</b>\n\n` +
      "━━━━━━━━━━━━━━\n" +
      "The moment the payment goes through, your ad appears on the board 🚀",
    forResultPaidCongrats: (e) =>
      "🎉 <b>Congratulations! Your ad is on the board!</b>\n\n" +
      `${e.mark} Your place right now: <b>#${e.place}</b>\n` +
      `💰 Paid in altogether: <b>${e.money}</b>\n\n` +
      "📣 Today's places are announced in our @foroneforever channel too.\n\n" +
      "💡 Want to go higher? Pay again — it adds on top of what you already put in!",
    forResultCancelled: "❌ Cancelled. The ad was not added.",
    forResultMyAdButton: "📌 My ad",
    forResultTopUpButton: "💰 Add payment",
    forResultEditButton: "✏️ Edit",
    forResultTop3Title: "👑 <b>TODAY'S TOP 3</b>\n",
    forResultRestTitle: "📋 <b>The other places</b>\n",
    forResultNoAd:
      "📌 <b>You don't have an ad yet</b>\n\n" +
      "This is where you can advertise your business, your blog or your channel.\n\n" +
      "💰 The more you put in, the higher you sit.\n\n" +
      "Start with \"➕ Add my ad\" below 👇",
    forResultMyAdTitle: "📌 <b>My ad</b>\n",
    forResultMyAdHidden:
      "\n🚫 <b>This ad is currently hidden.</b>\nTo find out why, write to us through \"🚨 Report\".",
    forResultTopUpAsk: (e) =>
      "💰 <b>Add payment</b>\n\n" +
      `📌 <b>${e.name}</b>\n` +
      `💰 Your amount right now: <b>${e.money}</b>\n` +
      `📊 Your place right now: <b>#${e.place}</b>\n\n` +
      "━━━━━━━━━━━━━━\n" +
      e.gapsBlock +
      `\nHow much would you like to add? Send the number only (minimum <b>${e.minMoney}</b>):`,
    forResultGapLine: (e) => `${e.mark} For <b>#${e.place}</b>: <b>+${e.need}</b> short`,
    forResultGapsHeader: "<b>To move up:</b>\n",
    forResultAlreadyTop:
      "🥇 <b>You are at #1!</b>\n" +
      "Put in more and your place gets harder still to take off you.\n",
    forResultEditPick: "✏️ <b>What would you like to change?</b>\n\nPick below 👇",
    forResultEditNameButton: "📌 Name",
    forResultEditPhotoButton: "🖼 Photo",
    forResultEditLinkButton: "🔗 Link",
    forResultEditAboutButton: "💬 Description",
    forResultEditSaved: "✅ <b>Saved!</b> Your ad has been updated.",
    forResultPickAdButton: "⚙️ Manage this ad",
    forResultAdSelected: (name) => `⚙️ Selected: <b>${name}</b>\n\nNow use the buttons below 👇`,
    unexpectedError:
      "⚠️ Something went wrong -- that didn't go through.\n\n" +
      "Please try again in a few seconds. If it keeps happening, report it with \u201c\ud83d\udea8 Report\u201d.",
    paymentProviderJoin: " or ",
    paymentDoneButton: "✅ I have paid",
    paymentPendingNotice:
      "⏳ Your payment hasn't been confirmed yet.\n\n" +
      "If you've just paid, wait 1–2 minutes and tap “✅ I have paid” again. " +
      "As soon as the bank confirms it, the feature switches on automatically and you'll get a message.\n\n" +
      "If you haven't paid yet, tap the Click or Payme button above 👆",
    paymentConfirmedNotice: "✅ Your payment is confirmed — the feature is active. Enjoy! 💛",
    unlockPaidOpenProfile:
      "🎉 <b>Payment received!</b>\n\n" +
      "🔓 This person's full profile is now open to you.\n\n" +
      "👇 Tap the button below to open it.",
    unlockOpenProfileButton: "👤 Open the profile",
    premiumActivated: (days) => `🎉 Premium activated! You'll have all the perks for ${days} days.`,
    premiumEnding7: (name) =>
      `👋 Hi${name ? ` <b>${name}</b>` : ""}!\n\n` +
      `💎 Your Premium has <b>one week</b> left ⏳\n\n` +
      `This month you've been:\n` +
      `🔓 opening profiles without limits\n` +
      `🔥 shown to others more often\n` +
      `🕵️ picking who you talk to in Anonymous chat\n\n` +
      `So — shall we go another round? 😄`,
    premiumEnding5: (name) =>
      `⏰ ${name ? `<b>${name}</b>, y` : "Y"}our Premium ends in <b>5 days</b>.\n\n` +
      `Just a heads up, nothing more 🙂\n` +
      `No rush — there's still time 💛`,
    premiumEnding3: (name) =>
      `🔔 ${name ? `<b>${name}</b>, y` : "Y"}our Premium ends in <b>3 days</b>.\n\n` +
      `If you've enjoyed it, shall we extend? 😊\n` +
      `⚡️ Takes about five minutes and everything carries on as it was.`,
    premiumEnded: (name) =>
      `😔 ${name ? `<b>${name}</b>, y` : "Y"}our Premium has ended.\n\n` +
      `From now on:\n` +
      `🔒 profiles are locked again\n` +
      `📉 yours is shown less often\n` +
      `🚫 no gender choice in Anonymous chat\n\n` +
      `All of it is one tap away though — bring it back? 💛`,
    premiumRenewButton: "💎 Yes, one more month",
    premiumRenewExpiredButton: "💎 Bring Premium back",
    premiumPurchaseCongrats: (days) =>
      "🎉 <b>Congratulations! Premium is active 💎</b>\n\n" +
      `📅 Valid for: <b>${days} days</b>\n\n` +
      "Here's what you can do now:\n" +
      "🔓 <b>Open any profile, unlimited</b> — no separate payments\n" +
      "🔥 <b>Your profile is shown more often</b> — more likes, more matches\n" +
      "🕵️ <b>Pick a gender in Anonymous chat</b> — 👧 or 👦, free all month\n" +
      "💛 <b>See everyone who liked you</b> — no limits\n" +
      "👑 <b>VIP group access</b> — free for now (temporary perk)\n\n" +
      "Tap “💘 New people” to get started 👇",
    vipPurchaseCongrats: (link) =>
      "🎉 <b>Congratulations! VIP chat access is open 👑</b>\n\n" +
      "What's waiting for you in the group:\n" +
      "💬 <b>Live conversation</b> — hundreds of guys and girls\n" +
      "🎯 <b>Icebreaker games</b> and active discussions\n" +
      "🛡 <b>Moderation</b> — no spam, no inappropriate messages\n\n" +
      `🔗 Here's your invite link:\n${link}`,
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
