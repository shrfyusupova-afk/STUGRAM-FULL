const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "profiles.json");

function readAll() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(profiles) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(profiles, null, 2));
}

function getProfile(userId) {
  return readAll()[String(userId)] || null;
}

function saveProfile(userId, profile) {
  const all = readAll();
  all[String(userId)] = { ...profile, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[String(userId)];
}

function deleteProfile(userId) {
  const all = readAll();
  delete all[String(userId)];
  writeAll(all);
}

module.exports = { getProfile, saveProfile, deleteProfile };
