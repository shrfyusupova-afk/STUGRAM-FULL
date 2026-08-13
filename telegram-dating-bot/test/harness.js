// Drives the REAL bot: loads src/index.js exactly as `npm start` does, then
// feeds it synthetic Telegram updates and records every API call it tries to
// make. Nothing is re-implemented here -- the middleware order, the wizard,
// the handler registration order are all the shipped ones.
//
// The Telegraf class is wrapped BEFORE index.js is required, so the instances
// index.js constructs can be reached and their network calls intercepted.
const path = require("path");
const ROOT = path.join(__dirname, "..");

process.env.TELEGRAM_BOT_TOKEN = "111:TEST";
process.env.ADMIN_BOT_TOKEN = "222:TEST";
process.env.ADMIN_PIN_CODE = "13579";
process.env.WEBHOOK_DOMAIN = "https://e2e.invalid";
process.env.PORT = "45999";
process.env.KEEP_AWAKE = "false";
// The Mini App is OFF in production (MINI_APP_ENABLED unset). It is switched
// on here so its code -- initData verification, server-side pricing -- stays
// covered by tests, since the code is kept for re-enabling rather than
// deleted. What production actually does with the flag off is verified
// separately; see the "disabled" check below this file's consumers.
process.env.MINI_APP_ENABLED = "true";
delete process.env.DATABASE_URL;

const telegraf = require(path.join(ROOT, "node_modules/telegraf"));
const Orig = telegraf.Telegraf;

const bots = [];
const calls = []; // { bot, method, payload }
const notSubscribed = new Set(); // user ids the channel gate should block

function fakeMessage(payload) {
  const msg = { message_id: Math.floor(Math.random() * 1e6), date: 0, chat: { id: payload.chat_id } };
  if (payload.photo) msg.photo = [{ file_id: "ADMIN_SIDE_FILE" }];
  if (payload.video) msg.video = { file_id: "ADMIN_SIDE_FILE" };
  return msg;
}

// handleUpdate builds a FRESH Telegram client for every update
// (`new Telegram(this.token, ...)`), so patching one instance leaves ctx
// talking to the real API. The prototype is the only place that catches
// every call, including the ones made from inside a scene.
const Telegram = require(path.join(ROOT, "node_modules/telegraf/lib/telegram.js")).default;
Telegram.prototype.callApi = async function (method, payload = {}) {
  const label = String(this.token).startsWith("222") ? "admin" : "main";
  calls.push({ bot: label, method, payload });
  if (method === "getMe") return { id: 111, is_bot: true, first_name: label, username: `${label}_bot` };
  if (method === "getFile") return { file_id: payload.file_id, file_path: "photos/x.jpg" };
  if (method === "getWebhookInfo") return { url: "" };
  // Channel membership, so the subscribe-gate can be driven from a test.
  // Everyone counts as subscribed by default, which keeps every test written
  // before the gate existed behaving exactly as it did; a test that wants to
  // exercise the gate adds the id to `notSubscribed`.
  if (method === "getChatMember") {
    return { status: notSubscribed.has(String(payload.user_id)) ? "left" : "member" };
  }
  if (/^send(Message|Photo|Video|Document|Animation|ChatAction)$/.test(method)) return fakeMessage(payload);
  if (method === "copyMessage") return { message_id: 1 };
  if (method === "getFileLink") return "https://e2e.invalid/file.jpg";
  return true;
};

class Wrapped extends Orig {
  constructor(token, opts) {
    super(token, opts);
    const label = token.startsWith("222") ? "admin" : "main";
    this.__label = label;
    this.botInfo = { id: Number(token.split(":")[0]), is_bot: true, first_name: label, username: `${label}_bot` };
    bots.push(this);
  }
}
// telegraf exports Telegraf through a getter (that is how its TypeScript
// build emits re-exports), so a plain assignment is silently discarded and
// index.js would quietly get the real class -- and really talk to Telegram.
Object.defineProperty(telegraf, "Telegraf", { value: Wrapped, configurable: true, enumerable: true });
if (telegraf.Telegraf !== Wrapped) throw new Error("failed to substitute Telegraf");

require(path.join(ROOT, "src/index.js"));

const mainBot = () => bots.find((b) => b.__label === "main");
const adminBot = () => bots.find((b) => b.__label === "admin");

// --- update builders ---------------------------------------------------------
let updateId = 1;
const USER = { id: 900001, is_bot: false, first_name: "Test", username: "testuser" };

function textUpdate(text, from = USER, entities) {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: from.id, type: "private" },
      from,
      text,
      ...(entities ? { entities } : {}),
    },
  };
}

// bot.start / bot.command match on the bot_command ENTITY, not on the raw
// text -- a synthetic "/start" without this is silently ignored.
function commandUpdate(text, from = USER) {
  return textUpdate(text, from, [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }]);
}

function callbackUpdate(data, from = USER) {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from,
      chat_instance: "1",
      data,
      message: { message_id: 1, date: 0, chat: { id: from.id, type: "private" }, text: "x" },
    },
  };
}

function contactUpdate(phone, from = USER) {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: from.id, type: "private" },
      from,
      contact: { phone_number: phone, user_id: from.id, first_name: from.first_name },
    },
  };
}

function photoUpdate(from = USER) {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: from.id, type: "private" },
      from,
      photo: [{ file_id: "MAIN_SIDE_FILE", width: 100, height: 100 }],
    },
  };
}

// --- driving -----------------------------------------------------------------
async function send(bot, update) {
  const before = calls.length;
  await bot.handleUpdate(update);
  return calls.slice(before);
}

function texts(sent) {
  return sent.filter((c) => c.method === "sendMessage").map((c) => c.payload.text);
}
function keyboardLabels(sent) {
  const out = [];
  for (const c of sent) {
    const rm = c.payload?.reply_markup;
    if (rm?.keyboard) for (const row of rm.keyboard) for (const b of row) out.push(typeof b === "string" ? b : b.text);
    if (rm?.inline_keyboard) for (const row of rm.inline_keyboard) for (const b of row) out.push(b.text);
  }
  return out;
}
function callbackData(sent) {
  const out = [];
  for (const c of sent) {
    const rm = c.payload?.reply_markup;
    if (rm?.inline_keyboard) for (const row of rm.inline_keyboard) for (const b of row) if (b.callback_data) out.push(b.callback_data);
  }
  return out;
}

module.exports = {
  bots,
  calls,
  notSubscribed,
  mainBot,
  adminBot,
  send,
  texts,
  keyboardLabels,
  callbackData,
  textUpdate,
  commandUpdate,
  callbackUpdate,
  contactUpdate,
  photoUpdate,
  USER,
};
