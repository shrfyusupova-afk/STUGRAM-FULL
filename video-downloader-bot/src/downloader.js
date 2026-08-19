// Turns a pasted link into either a video file on disk or a reason it can't
// be one. Nothing here talks to Telegram -- that separation is what makes
// this testable without a real bot, and what would let a second front end
// (a plain HTTP endpoint, say) reuse it later without dragging telegraf in.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ytdlp = require("./ytdlp");

const MAX_DURATION_SECONDS = Number(process.env.MAX_DURATION_SECONDS) || 900;
const MAX_UPLOAD_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 49) * 1024 * 1024;

// Matched against the WHOLE message text, not just extracted -- a caption
// like "qarang: https://youtu.be/xyz" still has to work, so this only pulls
// the URL out rather than requiring the message to be nothing else.
const URL_RE = /https?:\/\/[^\s]+/i;

const PLATFORMS = [
  { name: "youtube", re: /(?:youtube\.com\/(?:watch\?|shorts\/|embed\/)|youtu\.be\/)/i },
  { name: "tiktok", re: /tiktok\.com/i },
  { name: "instagram", re: /instagram\.com\/(?:p|reel|reels|tv)\//i },
];

function extractUrl(text) {
  const match = URL_RE.exec(String(text || ""));
  return match ? match[0] : null;
}

function detectPlatform(url) {
  if (!url) return null;
  const found = PLATFORMS.find((p) => p.re.test(url));
  return found ? found.name : null;
}

// What the wizard-equivalent step here is: given raw message text, decide
// whether there is anything to do at all, before spending a single yt-dlp
// call on it. Returns { url, platform } or null.
function parseRequest(text) {
  const url = extractUrl(text);
  const platform = detectPlatform(url);
  return platform ? { url, platform } : null;
}

class DownloadRefused extends Error {
  constructor(reasonKey, detail) {
    super(reasonKey);
    this.reasonKey = reasonKey;
    this.detail = detail;
  }
}

// Recognisable yt-dlp failures get a specific, honest reason; everything
// else collapses to "failed" rather than dumping a stack trace's worth of
// yt-dlp's own error text at somebody who just wants their video.
function classifyError(err) {
  const msg = String(err.message || "");
  if (/Sign in to confirm|not a bot/i.test(msg)) return "blocked";
  if (/Private video|This video is unavailable|is not available|Requested content is not available/i.test(msg))
    return "unavailable";
  if (/timed out/i.test(msg)) return "timeout";
  return "failed";
}

// One temp subdirectory per request, so cleanup is "delete this directory"
// rather than tracking individual filenames -- yt-dlp can leave behind a
// partial .part file or a separate audio track it merged from, and all of
// that has to go, not just the one path it eventually reports.
function requestDir() {
  const dir = path.join(os.tmpdir(), "video-downloader-bot", crypto.randomBytes(8).toString("hex"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Synchronous: the directory is small (one video, briefly), and every
// caller needs cleanup to have actually finished before it can honestly
// report "there is no file" -- an async fire-and-forget here would let a
// test (or an operator running `du`) observe the file a moment after this
// function returned.
function rmDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.error(`Could not clean up ${dir}:`, err.message);
  }
}

// Fetches metadata and REFUSES before downloading anything, for the two
// cases downloading can't fix: a stream with no end, and a video longer
// than the instance can reasonably spend on one request while everyone
// else's messages wait behind it.
async function checkInfo(url) {
  let info;
  try {
    info = await ytdlp.getInfo(url);
  } catch (err) {
    throw new DownloadRefused(classifyError(err), err.message);
  }
  if (info.is_live) throw new DownloadRefused("live");
  if (typeof info.duration === "number" && info.duration > MAX_DURATION_SECONDS) {
    throw new DownloadRefused("too_long", { duration: info.duration, limit: MAX_DURATION_SECONDS });
  }
  return info;
}

// The whole flow: check, download, verify the result actually fits through
// Telegram, or clean up and refuse. Callers get back either a file to send
// or a DownloadRefused explaining why there isn't one -- never a bare
// filesystem/yt-dlp error, which would mean leaking internals in a chat.
async function fetchVideo(url) {
  const info = await checkInfo(url);
  const dir = requestDir();

  let filePath;
  try {
    filePath = await ytdlp.download(url, path.join(dir, "video.%(ext)s"));
  } catch (err) {
    rmDir(dir);
    throw new DownloadRefused(classifyError(err), err.message);
  }

  const { size } = fs.statSync(filePath);
  if (size > MAX_UPLOAD_BYTES) {
    rmDir(dir);
    throw new DownloadRefused("too_large", { bytes: size, limit: MAX_UPLOAD_BYTES });
  }

  return {
    filePath,
    title: info.title || null,
    cleanup: () => rmDir(dir),
  };
}

module.exports = {
  extractUrl,
  detectPlatform,
  parseRequest,
  checkInfo,
  fetchVideo,
  classifyError,
  DownloadRefused,
  MAX_DURATION_SECONDS,
  MAX_UPLOAD_BYTES,
};
