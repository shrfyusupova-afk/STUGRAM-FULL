const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "{}");
  }
};

const readAll = () => {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};

const writeAll = (data) => {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

const getUser = (chatId) => readAll()[String(chatId)] || null;

const saveUser = (chatId, profile) => {
  const all = readAll();
  all[String(chatId)] = { ...all[String(chatId)], ...profile, chatId: String(chatId) };
  writeAll(all);
  return all[String(chatId)];
};

const deleteUser = (chatId) => {
  const all = readAll();
  delete all[String(chatId)];
  writeAll(all);
};

module.exports = { getUser, saveUser, deleteUser };
