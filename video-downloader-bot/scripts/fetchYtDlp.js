// Pulls down the yt-dlp standalone Linux binary at install time, not at
// first request. It is a ~40 MB download -- doing that on someone's first
// message would make the bot look dead for a minute; doing it in the build
// step means the deploy fails loudly if the binary can't be fetched, which
// is the moment an operator is actually watching.
//
// The "standalone" build (not the .zip one) is a self-contained executable
// with Python baked in, so nothing else has to be installed on the host --
// exactly what a plain Node buildpack (Render's default) doesn't provide.
const fs = require("fs");
const path = require("path");
const https = require("https");

const BIN_DIR = path.join(__dirname, "..", "bin");
const BIN_PATH = path.join(BIN_DIR, "yt-dlp");
const URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

function download(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("too many redirects"));
          return resolve(download(res.headers.location, destPath, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`GitHub returned ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(BIN_DIR, { recursive: true });

  // A previous install already has a working binary -- re-downloading 40 MB
  // on every `npm install` (e.g. after adding an unrelated dependency) would
  // be wasted time and bandwidth for no behaviour change. Delete bin/yt-dlp
  // by hand to force a refresh when a newer yt-dlp release is actually needed
  // (Instagram/TikTok/YouTube change their sites often enough that this is
  // a real maintenance task, not a one-time setup step).
  if (fs.existsSync(BIN_PATH)) {
    console.log("yt-dlp binary already present, skipping download.");
    return;
  }

  console.log("Downloading yt-dlp (standalone Linux binary)...");
  const tmpPath = `${BIN_PATH}.download`;
  await download(URL, tmpPath);
  fs.chmodSync(tmpPath, 0o755);
  fs.renameSync(tmpPath, BIN_PATH);
  console.log(`yt-dlp installed at ${BIN_PATH}`);
}

main().catch((err) => {
  console.error("Could not download yt-dlp -- the bot cannot download anything without it:", err.message);
  process.exit(1);
});
