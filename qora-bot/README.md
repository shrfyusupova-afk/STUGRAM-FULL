# Qora bot

Tanishuv va suhbatlashish uchun mo'ljallangan anonim Telegram bot (uyalmasdan muloqot qilish maqsadida).

## Ishga tushirish

```bash
cd qora-bot
npm install
cp .env.example .env   # BOT_TOKEN ni to'ldiring
npm start
```

## Hozirgi holat

`/start` bosilganda foydalanuvchidan ketma-ket anketa so'raladi:

1. Ism
2. Yosh
3. Jins (Erkak / Ayol — inline tugmalar)
4. Manzil
5. Ijtimoiy tarmoq akkaunti
6. Qisqacha ma'lumot

Anketa to'ldirilgach, asosiy menyu ko'rsatiladi (skrinshotdagidan farqli — vertikal ro'yxat ko'rinishidagi inline tugmalar):

- 🔍 Qidirish
- ⚙️ Anketa sozlamalari
- ❤️ Menga kim layk bosdi
- 👑 VIP CHAT
- 💎 PREMIUM

Anketa sozlamalari orqali anketani qayta to'ldirish mumkin. Qolgan tugmalar hozircha stub (vaqtincha xabar qaytaradi) — keyingi bosqichda haqiqiy funksiyalar bilan ulanadi.

Ma'lumotlar `data/users.json` faylida saqlanadi (git ga qo'shilmaydi).

## Render'da 24/7 ishlatish (Background Worker, $7/oy)

Pullik **Background Worker** xizmati HTTP trafikka bog'liq emas, shu sababli hech qachon "uxlab qolmaydi" — alohida pinger yoki health-check ham kerak emas.

### Blueprint orqali (eng tez yo'l)

1. https://render.com — GitHub hisobingiz bilan kiring va shu repo (`STUGRAM-FULL`)ni ulang (agar hali ulanmagan bo'lsa).
2. **New +** → **Blueprint** ni tanlang va shu repo'ni tanlang. Render `qora-bot/render.yaml` faylini o'zi topadi va sozlamalarni avtomatik to'ldiradi:
   - **Type**: Background Worker
   - **Root Directory**: `qora-bot`
   - **Plan**: Starter (~$7/oy)
3. `BOT_TOKEN` maydoniga botingiz tokenini qo'lda kiriting (u `render.yaml`da `sync: false` qilib qo'yilgan — xavfsizlik uchun repo'ga yozilmaydi).
4. **Apply** / **Deploy** ni bosing.

### Yoki qo'lda sozlash

1. **New +** → **Background Worker** ni tanlang, shu repo'ni ulang.
2. Sozlamalar:
   - **Root Directory**: `qora-bot`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Starter (~$7/oy)
3. **Environment** bo'limida qo'shing: `BOT_TOKEN` = botingiz tokeni.
4. **Deploy Background Worker** ni bosing.

Deploy tugagach, Render loglarida `Qora bot ishga tushdi.` chiqishi kerak — bu botning Telegram bilan ulanib, doimiy ishlayotganini bildiradi. Background Worker'da tashqi manzil (URL) berilmaydi, chunki bot HTTP so'rovlarni qabul qilmaydi — bu normal holat.

`src/keepAlive.js` fayli endi shart emas (u faqat bepul Web Service tarifida "uyg'ot" uchun kerak edi), lekin ziyoni yo'q — kodda qoldirdim, xohlasangiz olib tashlashingiz mumkin.

## Keyingi qadam

Menyudagi tugmalarning haqiqiy mantiqini (Qidirish, Layklar, VIP CHAT, PREMIUM) ulash.
