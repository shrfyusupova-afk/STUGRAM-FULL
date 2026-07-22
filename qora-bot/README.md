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

## Render'da 24/7 ishlatish (bepul tarif)

Bot Telegram bilan long polling orqali ishlaydi, ya'ni tashqaridan HTTP so'rov kelmaydi. Render'ning bepul Web Service tarifi esa ~15 daqiqa harakatsizlikdan keyin xizmatni "uxlatib qo'yadi". Buning oldini olish uchun bot ichida kichik health-check server (`src/keepAlive.js`) ishlaydi, va uni tashqi bepul "pinger" xizmati orqali muntazam uyg'otib turish kerak.

### 1) Render'da deploy qilish

1. https://render.com — GitHub hisobingiz bilan kiring va shu repo (`STUGRAM-FULL`)ni ulang.
2. **New +** → **Web Service** ni tanlang.
3. Repo tanlangandan so'ng:
   - **Root Directory**: `qora-bot`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. **Environment** bo'limida qo'shing: `BOT_TOKEN` = botingiz tokeni (hech qachon kodga yoki repo'ga yozmang).
5. **Create Web Service** ni bosing. Deploy tugagach, Render sizga `https://qora-bot-xxxx.onrender.com` kabi manzil beradi.

(`render.yaml` fayli allaqachon repo'da bor — Render'da **New +** → **Blueprint** orqali ham avtomatik shu sozlamalar bilan deploy qilishingiz mumkin, faqat `BOT_TOKEN`ni qo'lda kiritishingiz kerak bo'ladi.)

### 2) Uxlab qolmasligi uchun pinger sozlash

1. https://uptimerobot.com (yoki https://cron-job.org) da bepul hisob oching.
2. Yangi monitor yarating:
   - **Monitor Type**: HTTP(s)
   - **URL**: Render bergan manzil (masalan `https://qora-bot-xxxx.onrender.com`)
   - **Monitoring Interval**: 10 daqiqa (15 daqiqadan kam bo'lishi shart — Render aynan shu vaqtdan keyin uxlatadi)
3. Saqlang. Endi bu xizmat har 10 daqiqada botga so'rov yuborib, doim uyg'oq turishini ta'minlaydi.

Eslatma: bu — bepul usul, 100% kafolat bermaydi (masalan Render texnik ishlar olib borsa yoki pinger vaqtinchalik ishlamasa, bot bir necha daqiqaga "uyg'onishi" kerak bo'lishi mumkin). To'liq kafolatlangan, hech qachon uxlamaydigan variant — Render'ning pullik **Background Worker** xizmati (~$7/oy).

## Keyingi qadam

Menyudagi tugmalarning haqiqiy mantiqini (Qidirish, Layklar, VIP CHAT, PREMIUM) ulash.
