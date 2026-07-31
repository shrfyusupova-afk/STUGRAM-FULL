# ForOneForever — tizimning to'liq tavsifi

Bu hujjat botning **hammasini** bir joyda tushuntiradi: nima uchun kerak, qanday
qurilgan, qaysi fayl nima qiladi, pul qanday oqadi, xavfsizlik qanday
ta'minlangan, qanday joylashtiriladi va nimalarga ehtiyot bo'lish kerak.

Maqsad — oradan olti oy o'tib qaytib kelganda ham hech narsani qaytadan
kashf qilishga to'g'ri kelmasin.

> **Qamrov.** Bu hujjat faqat `telegram-dating-bot/` haqida. Repozitoriyning
> ildizidagi `android app/`, `backend/`, `Stugram-beckend-main/` — alohida,
> eski loyiha (Stugram). Ular bu botga ulanmagan va bu yerda joylashtirilmaydi.

---

## 1. Bu nima va nima uchun kerak

Telegram ichida ishlaydigan tanishuv xizmati. Foydalanuvchi hech qanday ilova
o'rnatmaydi — hammasi Telegram suhbatining ichida bo'lib o'tadi.

Odam anketa to'ldiradi, unga qarama-qarshi jinsdagi odamlarning anketalari
ko'rsatiladi, u ❤️ yoki 👎 bosadi. Ikki kishi bir-biriga ❤️ bossa — "mos
tushish" (match) bo'ladi va ikkalasi bir-birining telefon raqamini ko'radi.
Undan tashqari anonim suhbat, VIP guruh va Premium obuna bor.

**Nima uchun Telegram bot, ilova emas?** O'zbekistonda auditoriya allaqachon
Telegramda. Ilova o'rnatish, App Store'ga chiqish, push-bildirishnoma sozlash —
bularning hammasi kerak emas. Telegram allaqachon shaxsni tasdiqlaydi (telefon
raqam orqali), bildirishnoma yuboradi va to'lov sahifasini ochadi.

---

## 2. Ikkita bot, bitta jarayon

| Bot | Kim uchun | Vazifasi |
|---|---|---|
| **Asosiy bot** | foydalanuvchilar | anketa, tanishuv, layk, anonim chat, to'lov |
| **Admin bot** | faqat adminlar | statistika, qidiruv, shikoyatlar, reklama, o'chirish |

**Muhim:** ikkalasi ham **bitta Node jarayonida** ishlaydi. Bu ataylab shunday.
Agar ular ikkita alohida xizmat bo'lganida, ikkalasi ikkita alohida bazaga
qarardi yoki ular orasida sinxronlash yozish kerak bo'lardi. Hozir esa admin
profilni o'chirsa, o'sha zahoti asosiy bot uchun ham o'chgan bo'ladi — chunki
bu bitta va o'sha jadval.

Bitta joy istisno: **fayl identifikatorlari**. Telegramda `file_id` uni **qabul
qilgan botga** tegishli. Foydalanuvchi rasmni asosiy botga yuboradi, shuning
uchun admin bot o'sha `file_id` ni qayta yubora olmaydi — "wrong file
identifier" xatosi chiqadi. Buni `src/adminMedia.js` hal qiladi (7-bo'lim).

---

## 3. Umumiy tuzilma

```
                        Telegram serverlari
                                │
                    HTTPS webhook (maxfiy kalit bilan)
                                │
        ┌───────────────────────▼───────────────────────┐
        │            Express (src/index.js)             │
        │                                               │
        │  /telegram/webhook        → asosiy bot        │
        │  /telegram/admin-webhook  → admin bot         │
        │  /click/prepare           → Click to'lovi     │
        │  /click/complete          → Click to'lovi     │
        │  /app  /api/state  /api/order  /api/photo     │  ← Mini App
        │  /health                  → holat             │
        │  /policy                  → foydalanish shartlari │
        └───────────────────────┬───────────────────────┘
                                │
                          src/db.js
                                │
              DATABASE_URL bormi?
                ├── ha  → PostgreSQL   (jonli server)
                └── yo'q → JSON fayllar (mahalliy ishlash va testlar)
```

### Middleware tartibi — bu tartib muhim

`src/index.js` da ishlovchilar aynan shu ketma-ketlikda ro'yxatdan o'tadi.
Tartibni o'zgartirsangiz xatti-harakat buziladi:

```
1. floodGuard        — birinchi bo'lishi shart: hujumni hech qanday ish
                       qilinmasdan oldin to'xtatadi
2. session
3. stage (sehrgar)   — anketa ochiq bo'lsa, hamma narsa unga tegishli
4. anonChat          — bot.on("text") relay; menyudan oldin turishi shart
5. complaints        — bot.on("text") shikoyat matnini ushlaydi
6. accountNotices
7. menu
8. discover
9. likes
10. profileSettings
11. premium
12. vipChat
```

**Nega sehrgar oldinda?** Anketa to'ldirilayotganda "20" degan matn — bu yosh,
menyu tugmasi emas. Agar menyu oldinda bo'lganida, ismi "Premium" bo'lgan odam
anketasini to'ldira olmasdi.

**Nega bu tartib xato tug'dirgan edi?** Sehrgar `bot.start` dan oldin turgani
uchun `/start` ham sehrgarga borardi va **odamning ismi sifatida saqlanardi**.
Buni `src/scenes/profileWizard.js` dagi `commandName()` tuzatdi — buyruqlar
endi hech qachon ma'lumot emas.

---

## 4. Har bir fayl nima qiladi

### Yadro

| Fayl | Satr | Vazifasi |
|---|---|---|
| `src/index.js` | 623 | Express, webhook, ikkala botni yig'ish, to'lov yetkazish, `/health` |
| `src/db.js` | 97 | Qaysi bazani ishlatishni **bir marta** hal qiladi va bir xil API beradi |
| `src/i18n.js` | 598 | 103 ta matn kaliti × 3 til (uz / ru / en) |
| `src/menu.js` | 38 | Asosiy menyu klaviaturasi |

### Ma'lumot saqlash

| Fayl | Vazifasi |
|---|---|
| `src/storage/pgStore.js` | PostgreSQL: 10 jadval, indekslar, SQL so'rovlar |
| `src/storage/jsonStore.js` | JSON fayllar: bir xil API, mahalliy ishlash uchun |
| `src/storage/migrateJsonToPg.js` | Birinchi ishga tushishda eski JSON'ni bazaga ko'chiradi |

Ikkalasi **bir xil funksiya nomlarini** eksport qiladi. Farqi faqat: to'lov
jadvali va tez nomzod tanlash SQL'i faqat Postgres'da bor — `db.js` buni
`txStore: usePostgres ? {...} : null` va `pickCandidateRow || null` orqali
hal qiladi, chaqiruvchi kod esa yo'qligini sezib zaxira yo'lga o'tadi.

### Foydalanuvchi tomoni

| Fayl | Vazifasi |
|---|---|
| `src/scenes/profileWizard.js` | Anketa to'ldirish: 8 qadam, orqaga qaytish, tahrirlash |
| `src/discover.js` | Nomzod ko'rsatish, ❤️/👎, mos tushish, profil ochish |
| `src/likes.js` | "Kimlar yoqtirdi" ro'yxati |
| `src/profileSettings.js` | Anketani tahrirlash, ko'rish, faolsizlantirish |
| `src/anonChat.js` | Anonim suhbat: navbat, juftlash, uzatish, 3 daqiqa taymer |
| `src/premium.js` | Premium taklifi |
| `src/vipChat.js` | VIP guruh: qizlarga bepul, yigitlarga pullik |
| `src/complaints.js` | Shikoyat yozish va javobni yetkazish |
| `src/accountNotices.js` | Admin harakatlarini foydalanuvchiga **asosiy bot orqali** yetkazish |
| `src/miniApp.js` | Telegram Mini App: sahifa + API |
| `src/policy.js` | Foydalanish shartlari sahifasi |

### Admin tomoni

| Fayl | Vazifasi |
|---|---|
| `src/adminBot.js` | Butun admin panel: PIN, menyu, qidiruv, shikoyat, reklama |
| `src/adminMedia.js` | Anketa rasmini asosiy botdan admin botga o'tkazish + kesh |

### Yordamchilar

| Fayl | Vazifasi |
|---|---|
| `src/click.js` | Click to'lov tizimi: buyurtma, imzo tekshirish, callback |
| `src/floodGuard.js` | 10 soniyada 40 tadan ko'p yangilanish → tashlab yuboriladi |
| `src/profileLink.js` | Odamga havola qanday qurilishini **bir joyda** hal qiladi |
| `src/profileState.js` | `isRegistered(profile)` — anketa to'ldirilganmi |
| `src/botInfo.js` | Bot username va ochiq URL |
| `src/telegramSafety.js` | `safeAnswerCbQuery` — eskirgan tugma bosilsa yiqilmasin |

---

## 5. Ma'lumotlar bazasi

10 ta jadval. `CREATE TABLE IF NOT EXISTS` bilan yaratiladi, ya'ni har ishga
tushishda xavfsiz.

### `profiles` — asosiy jadval

| Ustun | Turi | Izoh |
|---|---|---|
| `user_id` | TEXT PK | Telegram id |
| `name`, `age`, `gender`, `gender_label` | | anketa |
| `location`, `bio`, `phone` | | anketa |
| `media_file_id`, `media_type` | TEXT | rasm/video (asosiy botga tegishli) |
| `active` | BOOLEAN | admin faolsizlantirsa FALSE |
| `premium_until` | TIMESTAMPTZ | Premium tugash sanasi |
| `anon_gender_until` | TIMESTAMPTZ | Anonim jins filtri tugash sanasi |
| `updated_at` | TIMESTAMPTZ | |

**Muhim:** obuna alohida jadvalda emas, aynan shu yerda **sana** sifatida
turadi. "Premium bormi?" degan savol — `premium_until > NOW()`. Bu obunani
o'chirish uchun alohida ish (cron) kerak emasligini bildiradi: sana o'tsa,
o'zi tugaydi.

### Qolgan jadvallar

| Jadval | Nima saqlaydi |
|---|---|
| `likes` | kim kimga ❤️ bosgan |
| `dislikes` | kim kimni 👎 qilgan (boshqa ko'rsatilmaydi) |
| `unlocks` | kim kimning profilini sotib olgan |
| `languages` | foydalanuvchi tili |
| `admins` | kim admin |
| `vip_chat_access` | kimda VIP guruhga kirish bor |
| `discover_state` | hozir qaysi anketa ochiq + oxirgi 500 ta ko'rilgan |
| `complaints` | shikoyatlar va javoblar |
| `click_transactions` | to'lovlar |

### Indekslar

```
likes_liked_idx        -- "meni kim yoqtirdi" tez ishlashi uchun
profiles_discover_idx  -- nomzod tanlash (qisman indeks: faqat mos qatorlar)
complaints_created_idx -- shikoyatlar ro'yxati
click_undelivered_idx  -- to'langan lekin yetkazilmagan buyurtmalar
```

---

## 6. Foydalanuvchi yo'li — boshidan oxirigacha

### 6.1 Ro'yxatdan o'tish (8 qadam)

```
/start
  ↓
Til tanlash            (inline: lang:uz / lang:ru / lang:en)
  ↓
1. Ism                 matn, 2–50 belgi
2. Yosh                18–90, faqat butun son
3. Jins                inline: gender:male / gender:female
4. Rasm yoki video     ← e'tibor bering: rasm 4-qadamda, manzildan OLDIN
5. Manzil              matn yoki lokatsiya tugmasi
6. O'zi haqida         maks. 80 belgi
7. Telefon raqam       "Raqamni yuborish" tugmasi (soxta anketaga qarshi)
8. Tasdiqlash          "✅ Ha" — shartlarga rozilik ham shu yerda
  ↓
Anketa saqlanadi → asosiy menyu
```

Har qadamda **⬅️ Orqaga** bor (birinchi qadamdan tashqari). Har bir qadam
**o'z klaviaturasini o'zi qo'yadi** — shuning uchun orqaga qaytganda ekran
har doim to'g'ri ko'rinadi.

**Yosh chegarasi 18 dan boshlanadi va shunday qoladi.** Bu tanishuv xizmati;
voyaga yetmaganlarni bunday muhitga kiritish mumkin emas.

### 6.2 Asosiy menyu

```
🔍 Yangi tanishuvlar     ⚙️ Anketa sozlamalari
💌 Kimlar yoqtirdi       👑 VIP suhbat
💎 Premium               🕵️ Anonim chat
🚨 Shikoyat qilmoqchiman
```

Mini App bu klaviaturada **yo'q** — u yozuv maydoni yonidagi Telegramning
o'z **Menu** tugmasida. Telegram Mini App'ni aynan o'sha yerga qo'yadi.

### 6.3 Tanishuv

```
🔍 bosildi
  ↓
Nomzod tanlanadi:
   • qarama-qarshi jins
   • rasmi va telefoni bor
   • active = TRUE
   • 👎 qilinmagan
   • oxirgi 500 ta ko'rilganlar ichida yo'q
   • Premium'lar 3 barobar ko'proq chiqadi
  ↓
Anketa kartasi (protect_content: true)
  ↓
❤️  → layk yoziladi
      • u ham sizni yoqtirgan bo'lsa → MOS TUSHDI, ikkalasi telefon oladi
      • aks holda → unga "sizni kimdir yoqtirdi" xabari (bir marta)
👎  → dislike yoziladi, boshqa chiqmaydi
🚨  → shu odam ustidan shikoyat
```

**Premium og'irligi qanday ishlaydi.** SQL shunday:

```sql
ORDER BY power(random(), 1.0 / (CASE WHEN premium_until > NOW() THEN 3 ELSE 1 END)) DESC
```

Bu Efraimidis–Spirakis usuli. `random() * og'irlik` emas — o'sha soddaroq
variant Premium'larni deyarli **hamisha** birinchi qo'yardi va oddiy
foydalanuvchilar umuman ko'rinmay qolardi. Hozirgi formula tanlanish
ehtimolini og'irlikka **aniq mutanosib** qiladi.

**Nega bitta SQL so'rov?** Avval kod butun bazani xotiraga o'qib, keyin
filtrlardi. Bu 1000 ta anketada ham, 1 000 000 ta anketada ham **har bir
surish** uchun bajarilardi. Endi filtrlash va tasodifiy tanlash bazaning
o'zida, indeks ustida bo'ladi.

### 6.4 Rasm himoyasi

Har bir anketa `protect_content: true` bilan yuboriladi. Bu:

- boshqa chatga **uzatib bo'lmaydi**
- telefonga **saqlab bo'lmaydi**
- Android'da **skrinshot olinmaydi**

iOS'da skrinshotni bloklab bo'lmaydi — Apple **hech bir ilovaga** bunga ruxsat
bermaydi. Bu Telegramning ham, bizning ham cheklovimiz emas, tizimning o'zi
shunday.

### 6.5 Anonim chat

```
🕵️ Anonim chat
  ↓
👧 Qiz bilan / 👦 O'g'il bilan   → pullik (12 900 so'm / hafta)
🎲 Random                        → bepul
  ↓
Navbat (maks. 10 daqiqa kutish)
  ↓
Juftlik topildi → 3 daqiqa suhbat
  ↓
Har ikki tomon "🛑 Suhbatni to'xtatish" bosishi mumkin
  ↓
Tugagach: "suhbatdoshdan shikoyat qilish" tugmasi
```

Navbat va faol suhbatlar **xotirada** saqlanadi, bazada emas. Sababi: bu
real vaqt holati, ma'lumot emas. Server qayta ishga tushsa, odam qaytadan
navbatga turadi — yo'qoladigan narsa yo'q.

Uzatishda **400 ms oraliq** bor. Odam yozganda bunga yetib bormaydi, lekin
skript bilan suhbatdoshni xabarga ko'mib tashlashning oldini oladi. Bu
botdagi yagona joy — bu yerda flood **aniq bir tirik odamga** tegadi.

---

## 7. Admin panel

### Kirish

```
/start → 🔐 Kod: _ _ _ _ _   (raqamli klaviatura)
  ↓
To'g'ri kod → admin bo'ladi va sessiya ochiladi (12 soat)
```

**Ikki xil narsa bor va ular chalkashtirilmasligi kerak:**

| | Nima | Qancha turadi |
|---|---|---|
| `admins` jadvali | "bu odam umuman admin bo'la oladimi" | doimiy |
| `adminSessions` xotirada | "u yaqinda o'zini tasdiqladimi" | 12 soat |

Shuning uchun kod bir marta sizib chiqsa ham, u abadiy kirish huquqini
bermaydi. Server qayta ishga tushsa hamma adminlar kodni qayta kiritadi —
bu xavfsiz tomonga qarab xato qilish.

### Noto'g'ri kodga qarshi himoya

- **Har bir odam uchun alohida**: 5s → 10s → 20s → 40s … maks. 5 daqiqa
- Avval bu **global** edi — bitta begona odam noto'g'ri kod kiritsa **hamma**
  adminlar bloklanardi. Bu xizmatni to'xtatish hujumi (DoS) edi.
- Ustiga global tom: daqiqasiga 100 ta urinish. Bu oddiy adminga hech qachon
  tegmaydi, lekin skriptni sekinlashtiradi.

### Menyu

| Tugma | Nima qiladi |
|---|---|
| 📊 Statistika | jami / erkak / ayol / faol / faolsiz / premium |
| 👥 Foydalanuvchilar | qidiruv (ism, id, telefon, @username) |
| 💰 Sotuvlar | har bir mahsulot bo'yicha sotuv va tushum |
| 🚨 Shikoyatlar | ro'yxat, ochish, javob yozish |
| 📢 Reklama berish | hammaga rasm + matn yuborish |
| 🚪 Admin bo'lishdan chiqish | sessiyani darhol tugatadi |

### Qidiruv qanday ishlaydi

```
"Jahongir" yozildi
  ↓
🔍 «Jahongir» — 3 ta topildi

1. /u_123456789
    👤 Jahongir
    📞 +998901234567
    🎂 2004-yil (22 yosh)
    🔗 profilga o'tish

2. /u_987654321
    ...
```

`/u_<id>` — bu **haqiqiy bot buyrug'i**, shuning uchun Telegram uni
avtomatik bosiladigan havolaga aylantiradi. Ya'ni "id ning o'zi havola".
Bosilsa, anketa pastda ochiladi.

Bir sahifada 10 ta, jami 300 tagacha. Undan ko'p bo'lsa qidiruvni
aniqlashtirish kerak — bu ataylab, chunki 10 000 ta natijani ko'rib chiqish
foydali emas.

### Anketa kartasi nima uchun tez ochiladi

Bu joy avval **daqiqalar** olardi. Uchta sabab bor edi:

1. **Telegram javob kutardi.** Telegraf webhook HTTP javobini butun ishlovchi
   tugagandan keyin yopadi. Rasm yuklab olinib qayta yuklanguncha Telegram
   kutardi, keyin "yetkazilmadi" deb hisoblab yangilanishni **qayta
   yuborardi** — kechikish uzayib borardi.
   *Yechim:* `sendChatAction` Telegrafning webhook-javob ro'yxatida, ya'ni
   o'sha chaqiruvning o'zi HTTP javob bo'ladi va aloqani darhol yopadi.
   Ustiga panel "rasm yuklanmoqda…" deb ko'rsatadi.

2. **Har safar mahkum urinish.** Kod avval asosiy botning `file_id` sini
   qayta yuborishga urinardi — bu alohida token bilan **hech qachon**
   ishlamaydi. *Yechim:* bir marta sinaladi va javob eslab qolinadi.

3. **Kesh yo'q edi.** Telegram qabul qilgan har yuklamaga o'ziga tegishli
   yangi `file_id` qaytaradi. Uni saqlamaslik har ko'rishda rasmni qaytadan
   yuklab olib qayta yuborishni bildirardi. *Yechim:* LRU kesh, 500 tagacha.

Natija: birinchi ochish — bitta yuklab olish + bitta yuborish; keyingi barcha
ochishlar — **bitta chaqiruv**.

### Admin harakatlari foydalanuvchiga qanday yetadi

Admin bot foydalanuvchiga to'g'ridan-to'g'ri yoza olmaydi — odam u bilan
suhbat ochmagan. Shuning uchun `src/accountNotices.js` xabarni **asosiy bot
orqali** yuboradi:

| Harakat | Foydalanuvchi nima ko'radi |
|---|---|
| Faolsizlantirish | "⏸ Anketangiz vaqtincha yopildi" |
| Qayta ochish | "✅ Anketangiz qayta ochildi" |
| O'chirish | "❌ Akkauntingiz o'chirildi" + 🆕 Yangi profil ochish + 🚨 Shikoyat qilish |

**O'chirish to'liq o'chiradi:** anketa, layklar, dislayklar, sotib olingan
profillar, VIP kirish, tanishuv holati — hammasi. Avval faqat anketa
o'chirilardi va qolgan yozuvlar "arvoh" bo'lib qolardi.

---

## 8. Pul: Click to'lov tizimi

### Mahsulotlar

| Mahsulot | Narx | Muddat | Nima beradi |
|---|---|---|---|
| 💎 Premium | 79 900 so'm | 30 kun | hamma profil ochiq + 3× ko'proq ko'rinish |
| 🔐 Profil ochish | 7 900 so'm | doimiy | bitta odamning aloqasi |
| 👑 VIP guruh | 59 900 so'm | doimiy | yopiq guruhga kirish |
| 🕵️ Anonim jins filtri | 12 900 so'm | 7 kun | 👧 yoki 👦 tanlash |

**VIP qizlarga bepul.** `profile.gender === "female"` bo'lsa to'lov tugmasi
o'rniga bepul kirish tugmasi chiqadi.

**Profil ochish uchun to'lash shart emas, agar:**
- allaqachon sotib olgan bo'lsangiz, **yoki**
- Premium'ingiz bo'lsa, **yoki**
- ikkovingiz bir-biringizni yoqtirgan bo'lsangiz (mos tushish)

### To'lov oqimi

```
Foydalanuvchi "To'lov qilish" bosadi
  ↓
createOrder() — click_transactions ga "pending" yozuv
  ↓
my.click.uz/services/pay?...&transaction_param=<buyurtma_id>
  ↓
Foydalanuvchi brauzerda to'laydi
  ↓
Click BIZNING serverga qo'ng'iroq qiladi:
  POST /click/prepare   (action=0)  → imzo tekshiriladi
  POST /click/complete  (action=1)  → imzo tekshiriladi, "paid" yoziladi
  ↓
deliverPaidOrder() — mahsulot BERILADI va foydalanuvchiga xabar ketadi
```

### Imzo qanday tekshiriladi

```
prepare:   md5(click_trans_id + service_id + SECRET + merchant_trans_id
               + amount + action + sign_time)
complete:  ...merchant_trans_id + merchant_prepare_id + amount...
```

Solishtirish `crypto.timingSafeEqual` bilan — oddiy `===` javob **vaqti**
orqali imzoni bitta-bitta topib olishga imkon berardi.

### Nima uchun to'lov "yo'qolmaydi"

Uchta himoya bor:

1. **Takroriy chaqiruv ikki marta hisoblanmaydi.** Bir marta "paid" bo'lgan
   buyurtma qayta kelsa `-4 Already paid` qaytadi va mahsulot ikkinchi marta
   berilmaydi.
2. **Yetkazilmagan buyurtmalar qayta uriniladi.** Agar Click qo'ng'irog'i
   paytida bot yiqilib tursa, pul o'tgan-u mahsulot berilmagan bo'ladi.
   `retryUndeliveredOrders()` har 5 daqiqada shunday buyurtmalarni topib
   yetkazadi.
3. **Narxni mijoz aytmaydi.** `/api/order` faqat **mahsulot nomini** oladi,
   summani serverning o'zi qidiradi. Aks holda Premium'ni 1 so'mga sotib
   olish mumkin bo'lardi.

### ⚠️ Hozirgi holat

`CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY` **hali
qo'yilmagan**. `/health` buni `clickPayments: NOT CONFIGURED` deb ko'rsatadi.
Bularsiz hech qanday to'lov mumkin emas — har bir pullik tugma "hali
sozlanmagan" deydi.

Kalitlarni olganingizda Click kabinetida callback manzillarini ham
o'zgartirish **shart**:

```
https://<domen>/click/prepare
https://<domen>/click/complete
```

Aks holda pul o'tadi, lekin funksiya yonmaydi.

---

## 9. Mini App

Telegramning o'z **Menu** tugmasidan ochiladigan HTML sahifa. Ichida:
profil kartasi, statistika (layklar soni), obunalar holati va sotib olish
tugmalari.

### Kimligini qanday tekshiradi

Telegram Mini App'ga `initData` beradi. Uni tekshirmasdan ishonib bo'lmaydi —
aks holda istalgan odam istalgan `user_id` yozib boshqa birovning ma'lumotini
o'qiy olardi.

```
secret = HMAC_SHA256("WebAppData", bot_token)
hash   = HMAC_SHA256(secret, dataCheckString)
```

Bunga qo'shimcha:
- `auth_date` yangiligi tekshiriladi (eski `initData` qabul qilinmaydi)
- solishtirish vaqt bo'yicha xavfsiz

### Rasm qanday ko'rsatiladi

`/api/photo` rasmni **server orqali** uzatadi. Telegramning fayl havolasiga
yo'naltirmaydi — chunki o'sha havolada **bot tokeni** bo'ladi va u brauzer
tarixiga, `Referer` sarlavhasiga tushib ketardi. Token esa botning to'liq
nazoratini beradi.

### Sinovdan o'tgan hujumlar

| Urinish | Natija |
|---|---|
| `initData` umuman yo'q | 401 |
| Axlat `initData` | 401 |
| Boshqa bot tokeni bilan imzolangan | 401 |
| To'g'ri, lekin 2 kun eski | 401 |
| Hash bitta belgiga o'zgartirilgan | 401 |
| Ma'lumot almashtirilgan, hash eski | 401 |
| Haqiqiy | 200 |
| `?type=free-please` | 400 |

---

## 10. Xavfsizlik

| Xavf | Himoya |
|---|---|
| Soxta Telegram yangilanishi | webhook `secret_token` — kalitsiz so'rov 404 |
| Flood / bot hujumi | 10 soniyada 40 ta yangilanish, keyin tashlanadi |
| Anonim chatda xabarga ko'mish | uzatishda 400 ms oraliq |
| Admin kodini brute force | shaxsiy kechikish 5s→5daq + global tom |
| O'g'irlangan admin kodi | 12 soatlik sessiya, chiqish tugmasi, huquqni bekor qilish |
| HTML in'ektsiya | anketa matnlari ekranlanadi (`<script>` → `&lt;script&gt;`) |
| SQL in'ektsiya | hamma so'rov parametrli (`$1`, `$2`) |
| Soxta to'lov | md5 imzo + `timingSafeEqual` |
| Narxni o'zgartirish | summa faqat serverdan |
| Mini App'ni aldash | `initData` HMAC + `auth_date` |
| Token sizib chiqishi | rasm server orqali uzatiladi, havola berilmaydi |
| Zaif kutubxonalar | `npm audit` — 0 zaiflik |

**Kodda maxfiy ma'lumot yo'q.** Hamma sir muhit o'zgaruvchisida. Faqat
`ADMIN_PIN_CODE` qo'yilmasa, kodda yozilgan zaxira PIN ishlatiladi — va bu
holatda bot har ishga tushishda ogohlantiradi va `/health` da ham ko'rinadi.

---

## 11. Joylashtirish (Render)

### Muhit o'zgaruvchilari

| Nomi | Majburiymi | Nima uchun |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **ha** | asosiy bot |
| `ADMIN_BOT_TOKEN` | yo'q | bo'lmasa admin panel ishlamaydi |
| `ADMIN_PIN_CODE` | **ha** | bo'lmasa kodda yozilgan PIN ishlatiladi |
| `DATABASE_URL` | **ha** | bo'lmasa ma'lumot har qayta ishga tushishda **yo'qoladi** |
| `CLICK_MERCHANT_ID` / `CLICK_SERVICE_ID` / `CLICK_SECRET_KEY` | to'lov uchun | |
| `TELEGRAM_WEBHOOK_SECRET` / `ADMIN_WEBHOOK_SECRET` | tavsiya | bo'lmasa har ishga tushishda yangisi yaratiladi |
| `KEEP_AWAKE` | yo'q | `false` qilinsa xizmat uxlashi mumkin |
| `RENDER_EXTERNAL_URL` | avtomatik | Render o'zi qo'yadi |

`render.yaml` hammasini bir marta e'lon qiladi — Render'da "New → Blueprint"
qilsangiz baza ham, xizmat ham, o'zgaruvchilar ham birga yaratiladi.

### ⚠️ Webhook maxfiy kaliti — bir marta butun botni o'ldirgan xato

Telegram `secret_token` da **faqat** `A-Z a-z 0-9 _ -` qabul qiladi.
Render'ning `generateValue: true` esa **base64** beradi — ichida `+`, `/`, `=`.

Natijada har ishga tushishda:

```
400 Bad Request: secret token contains unallowed characters
```

Bot boshqa hamma jihatdan sog'lom ko'rinardi — HTTPS ishlaydi, baza ulangan,
PIN o'rnatilgan — lekin **hech qanday xabar qabul qilmasdi**.

Hozir `src/index.js` har qanday kalitni Telegram qoidasiga solishtiradi va mos
kelmasa sha256 orqali mos qiymatga aylantiradi. **Bu qadamni olib tashlamang.**

### ⚠️ Xizmat uxlab qolishi

Render'ning bepul tarifi ~15 daqiqa harakatsizlikdan keyin xizmatni to'xtatadi.
O'lchangan: uyg'onish **26.7 soniya**. Odam uchun bu "bot buzilgan" degani, va
Telegram javob kutmay yangilanishni qayta yuboradi.

Yechim: xizmat har 10 daqiqada o'zining `/health` iga so'rov yuboradi.
Tasdiqlangan: 22 daqiqa sukutdan keyin javob **0.74 soniya**, jarayon esa
44 daqiqa davomida bir marta ham qayta ishga tushmadi.

**Narxi:** doim uyg'oq turish oyiga ~730 soat yeydi, bepul limit esa butun
akkaunt uchun 750 soat. Ya'ni **bitta** xizmatga yetadi, **ikkitasiga
yetmaydi**. Ikkinchi bepul xizmat ochsangiz `KEEP_AWAKE=false` qo'ying.

### `/health` nimani aytadi

```json
{
  "status": "ok",
  "storage": "postgres",
  "adminPin": "configured",
  "clickPayments": "NOT CONFIGURED (no payments possible)",
  "webhook": "registered",
  "commit": "de22f77",
  "startedAt": "2026-07-31T09:12:39.551Z",
  "keepAwake": true
}
```

Har bir maydon aniq bir savolga javob beradi:

| Maydon | Savol |
|---|---|
| `storage` | ma'lumot saqlanadimi yoki qayta ishga tushishda yo'qoladimi |
| `adminPin` | kodda yozilgan zaif PIN ishlatilyaptimi |
| `clickPayments` | to'lov umuman mumkinmi |
| `webhook` | bot xabar qabul qilyaptimi |
| `commit` | **qaysi kod ishlayapti** — deploy tushganini shundan bilasiz |
| `startedAt` | qayta ishga tushdimi (doim qulayotgan xizmatni ko'rsatadi) |
| `keepAwake` | keyingi bosish oniy bo'ladimi |

---

## 12. Testlar

```bash
cd telegram-dating-bot
npm test
```

Ikki fayl:

| Fayl | Nimani sinaydi |
|---|---|
| `test/adminMedia.test.js` | Admin kartasi nechta marta Telegramga boradi |
| `test/e2e.test.js` | 18 ta holat: butun bot |

### Testlar qanday ishlaydi

`test/harness.js` `src/index.js` ni **`npm start` qanday yuklasa shunday**
yuklaydi, keyin Telegrafning API klientini almashtiradi. Ya'ni sinovdan
o'tayotgan middleware tartibi, sehrgar va ishlovchilar — **jonli koddagilar**,
qayta yozilgani emas.

Bitta nozik joy: Telegraf `Telegraf` klassini **getter** orqali eksport qiladi,
shuning uchun oddiy o'zlashtirish jimgina bekor bo'ladi va test haqiqiy
Telegramga chiqib ketadi. `Object.defineProperty` ishlatiladi va almashtirish
tekshiriladi.

### 18 ta holat

```
ro'yxatdan o'tish va menyu           anonim chat: juftlash va uzatish
har bir menyu tugmasi javob beradi   anonim: jins filtri to'lov ortida
buyruq ma'lumot bo'lib saqlanmaydi   Click: imzo, faollashtirish, takror
layk bir marta xabar beradi          Mini App: 7 xil soxta urinish rad
shikoyat paytida menyu ishlaydi      Mini App: narxlar serverdan
HTML ekranlanadi                     webhook: kalitsiz so'rov rad
admin PIN himoyasi shaxsiy           admin: qidiruv va karta
admin harakati foydalanuvchiga yetadi o'chirilgan odam qaytadan boshlaydi
shikoyat zanjiri to'liq              chiqish sessiyani tugatadi
```

Testlar **bo'sh emasligi** tekshirilgan: tuzatishlarni qaytarib qo'yganda
tegishli test yiqiladi.

---

## 13. Yo'l davomida topilgan va tuzatilgan xatolar

Bularning har biri **jonli botda** yuz bergan yoki yuz berishi mumkin edi.
Ro'yxat shuning uchun ham muhim: bir xil xato qayta kirib qolmasin.

| Xato | Nima bo'lardi | Qanday topildi |
|---|---|---|
| Webhook base64 kalit tufayli ro'yxatdan o'tmasdi | bot **hech narsa qabul qilmasdi** | Telegram API xatosini o'qib |
| Admin kartasi daqiqalar ochilardi | admin ishlay olmasdi | Telegraf manba kodini o'qib |
| Xizmat uxlardi | birinchi bosish 27 soniya | `startedAt` qo'shib, o'lchab |
| `/start` ism bo'lib saqlanardi | anketada `"name": "/start"` | botni haydab ko'rib |
| Anketadan chiqish yo'li yo'q edi | odam qamalib qolardi | xuddi shunday |
| Menyu tugmasi shikoyat bo'lardi | keraksiz shikoyat, odam hech qayerga bormasdi | xuddi shunday |
| Premium og'irligi noto'g'ri | oddiy odamlar umuman ko'rinmasdi | jo'natishdan oldin hisoblab |
| Har surishda butun baza o'qilardi | 1M anketada ishlamasdi | ko'lam tahlili |
| O'chirish to'liq emas edi | arvoh layk/dislayk qolardi | kodni tekshirib |
| Reklama rasmi yetmasdi | faqat matn borardi | cross-bot `file_id` |
| Shikoyat kursori tozalanmasdi | javobdan keyingi har xabar yana javob bo'lardi | kodni tekshirib |
| `setTelegramUsername` arvoh qator yaratardi | "Xush kelibsiz, undefined" | xatoni ta'qib qilib |
| Admin PIN bloki global edi | bitta begona hamma adminni bloklardi | xavfsizlik tahlili |
| Mini App'da regex buzilgan edi | narx noto'g'ri ko'rinardi | sahifani chizib ko'rib |

---

## 14. Nimalarga hozir e'tibor kerak

### 🔴 Shoshilinch

1. **Click kalitlari yo'q.** Hech qanday to'lov mumkin emas. Kalitlarni
   qo'shgandan keyin Click kabinetidagi callback manzillarini yangi domenga
   o'zgartiring.

2. **Bepul Postgres 30 kunlik.** Muddati tugasa baza **o'chiriladi** —
   hamma anketa, layk va to'lov yozuvi bilan birga. Muddat tugashidan oldin
   tarifni ko'taring.

### 🟡 Bilib qo'yish kerak

3. **Bepul tarifda bitta xizmat.** Keep-alive oyiga ~730 soat yeydi,
   limit 750.

4. **VIP guruh havolasi kodda yozilgan** (`src/vipChat.js`). Telegramda
   havolani yangilasangiz, bu yerni ham o'zgartirib qayta joylashtirish kerak.

5. **Allaqachon layk bosilgan odam qaytib chiqadi.** Ro'yxat aylanib
   tugagach qaytadan boshlanadi. Zarari yo'q — dublikat yozilmaydi va
   ikkinchi xabar ketmaydi — lekin ❤️ bosgan odam hech qanday javob
   ko'rmaydi va bu chalkash tuyulishi mumkin.

6. **Anonim chat holati xotirada.** Server qayta ishga tushsa faol suhbatlar
   uziladi. Bu ataylab, lekin bilib qo'ying.

---

## 15. Qayerdan boshlash kerak

**Kod o'zgartirmoqchi bo'lsangiz:**

1. `npm test` — hozir 18/18 o'tishi kerak
2. O'zgartiring
3. `npm test` — yana o'ting
4. Push qiling → Render avtomatik joylashtiradi
5. `/health` da `commit` maydonini tekshiring — o'zgarishingiz jonli
   serverga tushganini **aynan shundan** bilasiz

**Bot javob bermayotgan bo'lsa, shu tartibda tekshiring:**

```
1. /health ochiladimi?          yo'q → xizmat o'chgan yoki qulayapti
2. "webhook": "registered"?      yo'q → webhookDetail sababni yozadi
3. "storage": "postgres"?        yo'q → DATABASE_URL yo'q, ma'lumot yo'qoladi
4. getWebhookInfo da xato bormi? → Telegram o'zi sababni aytadi
5. Render Logs                   → oxirgi chora
```

`getWebhookInfo` ni shunday ko'rasiz:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

`last_error_message` — Telegramning **o'z** xatosi. Bot jim qolganda bu
bizning loglarimizdan ham foydaliroq.
