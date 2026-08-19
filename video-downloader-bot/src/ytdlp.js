// The one place that shells out to the yt-dlp binary. Everything above this
// module talks in URLs, metadata objects and file paths -- never in yt-dlp's
// own flags or exit codes -- so a future yt-dlp upgrade that changes its CLI
// only has to be reconciled here.
const { spawn } = require("child_process");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const BIN_PATH = path.join(__dirname, "..", "bin", "yt-dlp");

// yt-dlp is asked to run itself, not a shell -- so a URL containing `; rm -rf`
// (typed or pasted by anyone) is just a URL argument, never shell syntax.
function run(args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(BIN_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => (stdout += chunk));
    // Capped: a page yt-dlp can't parse sometimes echoes the whole HTML body
    // to stderr, and keeping all of that in memory for a string nobody reads
    // past the first few lines is pure waste.
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 8000) stderr += chunk;
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) return reject(new Error("timed out"));
      if (code !== 0) return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      resolve({ stdout, stderr });
    });
  });
}

// Metadata only -- no download. Used to check duration and whether something
// is a live stream BEFORE committing to pulling the actual video down.
async function getInfo(url, { timeoutMs = 20_000 } = {}) {
  const { stdout } = await run(["--dump-single-json", "--no-warnings", "--no-playlist", url], { timeoutMs });
  return JSON.parse(stdout);
}

// Downloads to `outputTemplate` (a yt-dlp -o template, e.g. "/tmp/x.%(ext)s")
// and returns the real path yt-dlp wrote to -- the extension in the template
// is a hint, not a promise, since the actual container depends on what the
// source offered and how ffmpeg merged it.
async function download(url, outputTemplate, { timeoutMs = 180_000 } = {}) {
  const { stdout } = await run(
    [
      "-f",
      // Prefer something already under the cap so no merge/re-encode is
      // needed at all; fall back to the best available otherwise and let the
      // caller's post-download size check be the real gate.
      "best[height<=720][filesize<48M]/best[height<=720]/best",
      "--merge-output-format",
      "mp4",
      "--ffmpeg-location",
      ffmpegPath,
      "--no-warnings",
      "--no-playlist",
      "--print",
      "after_move:filepath",
      "-o",
      outputTemplate,
      url,
    ],
    { timeoutMs }
  );
  const filePath = stdout.trim().split("\n").pop();
  if (!filePath) throw new Error("yt-dlp did not report where the file was saved");
  return filePath;
}

module.exports = { getInfo, download, BIN_PATH };
