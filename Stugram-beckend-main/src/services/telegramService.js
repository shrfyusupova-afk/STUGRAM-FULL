const crypto = require("crypto");

const TelegramLinkCode = require("../models/TelegramLinkCode");
const OtpCode = require("../models/OtpCode");
const User = require("../models/User");
const { env } = require("../config/env");
const { hashOtp } = require("../utils/token");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

const LINK_CODE_EXPIRES_MINUTES = 10;
const REGISTER_OTP_EXPIRES_MINUTES = 15;
const TELEGRAM_API_BASE = "https://api.telegram.org";

const isTelegramConfigured = () => Boolean(env.telegramBotToken);

const identityForChat = (chatId) => `tg:${chatId}`;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendTelegramMessage = async (chatId, text, extra = {}) => {
  if (!isTelegramConfigured()) {
    throw new Error("Telegram bot is not configured");
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    logger.error("telegram_send_message_failed", {
      status: response.status,
      message: errorText.slice(0, 300),
    });
    throw new Error(`Telegram sendMessage failed with status ${response.status}`);
  }

  return response.json();
};

const replySafely = (chatId, text, extra = {}) =>
  sendTelegramMessage(chatId, text, extra).catch(() => {});

const createLinkCode = async () => {
  if (!isTelegramConfigured()) {
    throw new ApiError(503, "Telegram login is not configured");
  }

  const code = crypto.randomBytes(6).toString("hex");
  const expiresAt = new Date(Date.now() + LINK_CODE_EXPIRES_MINUTES * 60 * 1000);

  await TelegramLinkCode.create({ code, expiresAt });

  return {
    code,
    expiresAt,
    botUsername: env.telegramBotUsername,
    deepLink: env.telegramBotUsername ? `https://t.me/${env.telegramBotUsername}?start=${code}` : null,
  };
};

const getLinkStatus = async (code) => {
  const record = await TelegramLinkCode.findOne({ code });

  if (!record || record.expiresAt < new Date()) {
    throw new ApiError(404, "Link code expired or not found");
  }

  if (!record.linked) {
    return { linked: false };
  }

  const identity = record.chatId ? identityForChat(record.chatId) : null;
  const existingUser = identity
    ? await User.findOne({ identity }).select("username")
    : null;

  return {
    linked: true,
    alreadyRegistered: Boolean(existingUser),
    existingUsername: existingUser?.username || null,
    identity,
    phoneNumber: record.phoneNumber,
    telegramUsername: record.telegramUsername,
    firstName: record.firstName,
    // The register OTP is only meaningful for fresh registrations; the code
    // param is the shared secret that authorizes reading it.
    otp: existingUser ? null : record.otp,
  };
};

const CONTACT_REQUEST_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

const REMOVE_KEYBOARD = {
  reply_markup: { remove_keyboard: true },
};

const handleStartCommand = async (message) => {
  const chat = message.chat;
  const code = message.text.replace("/start", "").trim();

  if (!code) {
    await replySafely(
      chat.id,
      "Assalomu alaykum! 👋\n\nRo'yxatdan o'tish Stugram ilovasi orqali boshlanadi. Ilovadagi \"Telegram orqali ro'yxatdan o'tish\" tugmasini bosing — bot sizni shu yerga o'zi olib keladi."
    );
    return;
  }

  const record = await TelegramLinkCode.findOne({ code });
  if (!record || record.expiresAt < new Date()) {
    await replySafely(
      chat.id,
      "Bu havolaning muddati o'tgan. ⏳\nIlovaga qaytib, \"Telegram orqali ro'yxatdan o'tish\" tugmasini qaytadan bosing."
    );
    return;
  }

  record.chatId = String(chat.id);
  record.telegramUsername = chat.username || null;
  record.firstName = chat.first_name || null;

  const existingUser = await User.findOne({ identity: identityForChat(chat.id) }).select("username");
  if (existingUser) {
    // Let the app stop waiting and show the "already registered" path.
    record.linked = true;
    await record.save();
    await replySafely(
      chat.id,
      `Siz allaqachon ro'yxatdan o'tgansiz (@${existingUser.username}). ✅\nIlovadagi \"Kirish\" bo'limidan username va parolingiz bilan kiring. Parolni unutgan bo'lsangiz, \"Parolni unutdingizmi?\" tugmasini bosing.`,
      REMOVE_KEYBOARD
    );
    return;
  }

  await record.save();
  await replySafely(
    chat.id,
    "Stugram'ga xush kelibsiz! 👋\n\nRo'yxatdan o'tishni davom ettirish uchun pastdagi tugma orqali telefon raqamingizni yuboring.",
    CONTACT_REQUEST_KEYBOARD
  );
};

const handleContactMessage = async (message) => {
  const chat = message.chat;
  const contact = message.contact;

  // Only accept the user's own contact card, not a forwarded one.
  if (contact.user_id && String(contact.user_id) !== String(chat.id)) {
    await replySafely(chat.id, "Iltimos, o'zingizning telefon raqamingizni yuboring.", CONTACT_REQUEST_KEYBOARD);
    return;
  }

  const record = await TelegramLinkCode.findOne({
    chatId: String(chat.id),
    linked: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    await replySafely(
      chat.id,
      "Faol so'rov topilmadi. Ilovaga qaytib, \"Telegram orqali ro'yxatdan o'tish\" tugmasini qaytadan bosing.",
      REMOVE_KEYBOARD
    );
    return;
  }

  const identity = identityForChat(chat.id);

  const existingUser = await User.findOne({ identity }).select("username");
  if (existingUser) {
    record.linked = true;
    await record.save();
    await replySafely(
      chat.id,
      `Siz allaqachon ro'yxatdan o'tgansiz (@${existingUser.username}). Ilovadagi \"Kirish\" bo'limidan kiring. ✅`,
      REMOVE_KEYBOARD
    );
    return;
  }

  // Contact share proves ownership of this Telegram account, so the register
  // OTP is created pre-verified: the app picks it up via link-status and
  // finishes registration without the user retyping anything.
  const otp = generateOtp();
  await OtpCode.deleteMany({ identity, purpose: "register" });
  await OtpCode.create({
    identity,
    purpose: "register",
    codeHash: hashOtp(identity, otp),
    isVerified: true,
    expiresAt: new Date(Date.now() + REGISTER_OTP_EXPIRES_MINUTES * 60 * 1000),
  });

  const rawPhone = String(contact.phone_number || "").replace(/\s+/g, "");
  record.phoneNumber = rawPhone && !rawPhone.startsWith("+") ? `+${rawPhone}` : rawPhone || null;
  record.firstName = chat.first_name || record.firstName;
  record.otp = otp;
  record.linked = true;
  await record.save();

  logger.info("telegram_contact_linked", { chatId: String(chat.id) });

  await replySafely(
    chat.id,
    "Raqamingiz tasdiqlandi! ✅\n\nEndi Stugram ilovasiga qayting — ro'yxatdan o'tish avtomatik davom etadi.",
    REMOVE_KEYBOARD
  );
};

// Called by the Telegram webhook for every bot update. Handles the two steps
// of the registration handshake: "/start <code>" (from the app's deep link)
// and the contact-share reply.
const handleTelegramUpdate = async (update) => {
  const message = update?.message;
  const chat = message?.chat;

  if (!message || !chat || chat.type !== "private") {
    return;
  }

  if (message.contact) {
    await handleContactMessage(message);
    return;
  }

  if (typeof message.text === "string" && message.text.startsWith("/start")) {
    await handleStartCommand(message);
  }
};

module.exports = {
  isTelegramConfigured,
  sendTelegramMessage,
  createLinkCode,
  getLinkStatus,
  handleTelegramUpdate,
};
