const mongoose = require("mongoose");

const telegramLinkCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatId: {
      type: String,
      default: null,
    },
    telegramUsername: {
      type: String,
      default: null,
    },
    linked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TelegramLinkCode", telegramLinkCodeSchema);
