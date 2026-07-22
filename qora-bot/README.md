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

## Keyingi qadam

Menyudagi tugmalarning haqiqiy mantiqini (Qidirish, Layklar, VIP CHAT, PREMIUM) ulash.
