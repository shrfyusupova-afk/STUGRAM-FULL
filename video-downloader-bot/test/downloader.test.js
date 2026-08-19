// The decision logic around a download -- refuse a live stream or an
// oversized result, clean up the temp directory on every exit path -- has to
// be right without actually reaching Instagram/TikTok/YouTube on every test
// run (those go down, rate-limit, or change their site independently of
// whether this code is correct). So ytdlp.js is mocked here: these tests
// drive downloader.js's own decisions, not yt-dlp's.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ytdlp = require("../src/ytdlp");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Swaps ytdlp's exported functions for the duration of one test and restores
// them afterwards -- downloader.js holds a reference to the ytdlp module
// object and calls `ytdlp.getInfo(...)`, so overwriting the properties here
// is visible to it without downloader.js needing to know it's under test.
function withMockYtdlp({ getInfo, download }, fn) {
  const realGetInfo = ytdlp.getInfo;
  const realDownload = ytdlp.download;
  ytdlp.getInfo = getInfo || realGetInfo;
  ytdlp.download = download || realDownload;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      ytdlp.getInfo = realGetInfo;
      ytdlp.download = realDownload;
    });
}

// A require cache reset is needed between tests that set different env vars
// (MAX_DURATION_SECONDS, MAX_UPLOAD_MB) -- downloader.js reads them once at
// module load, the same way the real process would.
function freshDownloader() {
  delete require.cache[require.resolve("../src/downloader")];
  return require("../src/downloader");
}

test("a normal video is accepted: info fetched, downloaded, cleaned up on request", async () => {
  const cleanupDir = path.join(os.tmpdir(), "dlt-" + Date.now());
  fs.mkdirSync(cleanupDir, { recursive: true });
  const filePath = path.join(cleanupDir, "video.mp4");
  fs.writeFileSync(filePath, Buffer.alloc(1024));

  await withMockYtdlp(
    {
      getInfo: async () => ({ duration: 30, is_live: false, title: "A short clip" }),
      download: async () => filePath,
    },
    async () => {
      const downloader = freshDownloader();
      const result = await downloader.fetchVideo("https://youtu.be/abc123");
      assert.strictEqual(result.filePath, filePath);
      assert.strictEqual(result.title, "A short clip");
      assert.ok(fs.existsSync(filePath), "the file must exist before cleanup");
      result.cleanup();
    }
  );
});

test("a live stream is refused before any download is attempted", async () => {
  let downloadCalled = false;
  await withMockYtdlp(
    {
      getInfo: async () => ({ duration: null, is_live: true }),
      download: async () => {
        downloadCalled = true;
        throw new Error("must not be called");
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(
        () => downloader.fetchVideo("https://youtu.be/live123"),
        (err) => err instanceof downloader.DownloadRefused && err.reasonKey === "live"
      );
      assert.strictEqual(downloadCalled, false, "a live stream has no end -- downloading it must never start");
    }
  );
});

test("a video longer than the configured limit is refused before downloading", async () => {
  process.env.MAX_DURATION_SECONDS = "60";
  let downloadCalled = false;
  await withMockYtdlp(
    {
      getInfo: async () => ({ duration: 3600, is_live: false }),
      download: async () => {
        downloadCalled = true;
        throw new Error("must not be called");
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(
        () => downloader.fetchVideo("https://youtu.be/long123"),
        (err) => err instanceof downloader.DownloadRefused && err.reasonKey === "too_long"
      );
      assert.strictEqual(downloadCalled, false);
    }
  );
  delete process.env.MAX_DURATION_SECONDS;
});

test("a downloaded file over the upload limit is refused AND deleted, not sent", async () => {
  process.env.MAX_UPLOAD_MB = "1";
  // The mock has to write INSIDE the directory fetchVideo itself created
  // (implied by outputTemplate) -- that is the directory it will clean up,
  // so a file written anywhere else would make this assertion meaningless.
  let filePath;
  await withMockYtdlp(
    {
      getInfo: async () => ({ duration: 30, is_live: false, title: "Big file" }),
      download: async (url, outputTemplate) => {
        filePath = path.join(path.dirname(outputTemplate), "video.mp4");
        fs.writeFileSync(filePath, Buffer.alloc(2 * 1024 * 1024)); // 2 MB, over the 1 MB cap
        return filePath;
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(
        () => downloader.fetchVideo("https://youtu.be/big123"),
        (err) => err instanceof downloader.DownloadRefused && err.reasonKey === "too_large"
      );
      // Not just refused -- an oversized file left on disk forever is a slow
      // leak that eventually fills the instance's disk for everyone.
      assert.ok(!fs.existsSync(filePath), "the oversized file must be deleted, not left behind");
    }
  );
  delete process.env.MAX_UPLOAD_MB;
});

test("YouTube's bot-check is reported as 'blocked', not a bare crash", async () => {
  await withMockYtdlp(
    {
      getInfo: async () => {
        throw new Error("ERROR: Sign in to confirm you're not a bot.");
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(
        () => downloader.checkInfo("https://youtu.be/xyz"),
        (err) => err instanceof downloader.DownloadRefused && err.reasonKey === "blocked"
      );
    }
  );
});

test("a private or removed video is reported as 'unavailable'", async () => {
  await withMockYtdlp(
    {
      getInfo: async () => {
        throw new Error("ERROR: Private video. Sign in if you've been granted access to this video");
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(
        () => downloader.checkInfo("https://instagram.com/p/xyz"),
        (err) => err instanceof downloader.DownloadRefused && err.reasonKey === "unavailable"
      );
    }
  );
});

test("an unrecognised yt-dlp failure collapses to 'failed', not a stack trace", async () => {
  await withMockYtdlp(
    {
      getInfo: async () => {
        throw new Error("ERROR: something wildly unexpected happened deep inside yt-dlp's parser");
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(
        () => downloader.checkInfo("https://youtu.be/xyz"),
        (err) => err instanceof downloader.DownloadRefused && err.reasonKey === "failed"
      );
    }
  );
});

test("a failure during the actual download still cleans up the temp directory", async () => {
  let dirAtDownloadTime = null;
  await withMockYtdlp(
    {
      getInfo: async () => ({ duration: 30, is_live: false }),
      download: async (url, outputTemplate) => {
        dirAtDownloadTime = path.dirname(outputTemplate);
        throw new Error("ERROR: network blew up mid-download");
      },
    },
    async () => {
      const downloader = freshDownloader();
      await assert.rejects(() => downloader.fetchVideo("https://youtu.be/fail123"));
      assert.ok(dirAtDownloadTime, "the mock must have been called with a real directory");
      assert.ok(!fs.existsSync(dirAtDownloadTime), "the temp directory must not survive a failed download");
    }
  );
});

// --- go ----------------------------------------------------------------------
(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok   - ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL - ${name}\n       ${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
