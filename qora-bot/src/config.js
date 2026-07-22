require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN topilmadi. .env faylini tekshiring (qora-bot/.env.example ga qarang).");
}

module.exports = { BOT_TOKEN };
