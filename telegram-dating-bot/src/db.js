const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "profiles.json");
const LANG_DB_PATH = path.join(__dirname, "..", "data", "languages.json");
const LIKES_DB_PATH = path.join(__dirname, "..", "data", "likes.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getProfile(userId) {
  return readJson(DB_PATH)[String(userId)] || null;
}

function saveProfile(userId, profile) {
  const all = readJson(DB_PATH);
  all[String(userId)] = { ...profile, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[String(userId)];
}

function deleteProfile(userId) {
  const all = readJson(DB_PATH);
  delete all[String(userId)];
  writeJson(DB_PATH, all);
}

function getAllProfiles() {
  return readJson(DB_PATH);
}

function setProfileActive(userId, active) {
  const all = readJson(DB_PATH);
  const key = String(userId);
  if (!all[key]) return null;
  all[key] = { ...all[key], active, updatedAt: new Date().toISOString() };
  writeJson(DB_PATH, all);
  return all[key];
}

function recordLike(likerId, likedId) {
  const all = readJson(LIKES_DB_PATH);
  const key = String(likedId);
  const likers = new Set(all[key] || []);
  likers.add(String(likerId));
  all[key] = [...likers];
  writeJson(LIKES_DB_PATH, all);
}

function getLikers(userId) {
  return readJson(LIKES_DB_PATH)[String(userId)] || [];
}

function getLanguage(userId) {
  return readJson(LANG_DB_PATH)[String(userId)] || null;
}

function setLanguage(userId, lang) {
  const all = readJson(LANG_DB_PATH);
  all[String(userId)] = lang;
  writeJson(LANG_DB_PATH, all);
}

module.exports = {
  getProfile,
  saveProfile,
  deleteProfile,
  getAllProfiles,
  setProfileActive,
  getLanguage,
  setLanguage,
  recordLike,
  getLikers,
};
