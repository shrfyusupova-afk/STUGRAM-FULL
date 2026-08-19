// Which links this bot will even attempt, and which it silently leaves
// alone. A false positive here would send a plain sentence containing a
// stray URL into yt-dlp and produce a confusing error; a false negative
// would ignore a link the bot should have handled.
const assert = require("assert");
const { extractUrl, detectPlatform, parseRequest } = require("../src/downloader");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("extracts a URL out of a longer sentence", () => {
  assert.strictEqual(
    extractUrl("qarang bu link https://youtu.be/abc123 zo'r edi"),
    "https://youtu.be/abc123"
  );
});

test("a message with no URL extracts nothing", () => {
  assert.strictEqual(extractUrl("salom, qalaysiz?"), null);
});

const YOUTUBE_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
];
for (const url of YOUTUBE_URLS) {
  test(`recognises a YouTube link: ${url}`, () => {
    assert.strictEqual(detectPlatform(url), "youtube");
  });
}

const TIKTOK_URLS = [
  "https://www.tiktok.com/@someone/video/123456",
  "https://vm.tiktok.com/ABC123/",
  "https://vt.tiktok.com/ABC123/",
];
for (const url of TIKTOK_URLS) {
  test(`recognises a TikTok link: ${url}`, () => {
    assert.strictEqual(detectPlatform(url), "tiktok");
  });
}

const INSTAGRAM_URLS = [
  "https://www.instagram.com/p/ABC123/",
  "https://www.instagram.com/reel/ABC123/",
  "https://www.instagram.com/reels/ABC123/",
];
for (const url of INSTAGRAM_URLS) {
  test(`recognises an Instagram link: ${url}`, () => {
    assert.strictEqual(detectPlatform(url), "instagram");
  });
}

const UNSUPPORTED_URLS = [
  "https://example.com",
  "https://twitter.com/someone/status/123",
  // An Instagram PROFILE, not a post -- there is no single video to hand
  // back, so this must be left alone rather than handed to yt-dlp to fail on.
  "https://www.instagram.com/someone/",
];
for (const url of UNSUPPORTED_URLS) {
  test(`leaves an unsupported link alone: ${url}`, () => {
    assert.strictEqual(detectPlatform(url), null);
  });
}

test("parseRequest combines extraction and detection", () => {
  const req = parseRequest("check this out: https://youtu.be/abc123");
  assert.deepStrictEqual(req, { url: "https://youtu.be/abc123", platform: "youtube" });
});

test("parseRequest returns null for a message with no supported link", () => {
  assert.strictEqual(parseRequest("hello there"), null);
  assert.strictEqual(parseRequest("https://example.com/cat.jpg"), null);
});

// --- go ----------------------------------------------------------------------
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok   - ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL - ${name}\n       ${err.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
