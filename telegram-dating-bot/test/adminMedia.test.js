// Counts the actual Telegram round trips an admin card costs, by standing in
// for ctx and the main bot's client. The point of the change under test is
// exactly "how many calls", so that is what is measured.
const assert = require("assert");
const { replyWithProfileMedia, resetMediaCache } = require("../src/adminMedia");

const PROFILE = { mediaFileId: "MAIN_FILE_ID", mediaType: "photo" };

function makeWorld({ sameToken = false } = {}) {
  const calls = [];
  const ctx = {
    async replyWithPhoto(media, extra) {
      const isUpload = typeof media === "object";
      calls.push(isUpload ? "upload" : `resend:${media}`);
      if (!isUpload && media === "MAIN_FILE_ID" && !sameToken) {
        throw new Error("Bad Request: wrong file identifier");
      }
      if (!isUpload && media === "STALE_ADMIN_ID") {
        throw new Error("Bad Request: wrong file identifier");
      }
      return { photo: [{ file_id: "small" }, { file_id: "ADMIN_FILE_ID" }] };
    },
  };
  const mainBotTelegram = {
    async getFileLink() {
      calls.push("getFileLink");
      return "https://api.telegram.org/file/botX/photo.jpg";
    },
  };
  return { ctx, mainBotTelegram, calls };
}

// fetchProfileMedia uses global fetch; stand in for the network.
let fetchCount = 0;
global.fetch = async () => {
  fetchCount++;
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
};

// Every body is async, so this MUST await it -- awaiting nothing would print
// "ok" before a single assertion had run and turn every failure into an
// unhandled rejection nobody reads.
const tests = [];
function run(name, fn) {
  tests.push(async () => {
    resetMediaCache();
    fetchCount = 0;
    await fn();
    console.log(`ok - ${name}`);
  });
}

// --- two-token deployment: the real one -------------------------------------
run("first view crosses the bot boundary, later views do not", () => {
  const { ctx, mainBotTelegram, calls } = makeWorld();

  return (async () => {
    assert.strictEqual(await replyWithProfileMedia(ctx, PROFILE, {}, mainBotTelegram), null);
    assert.deepStrictEqual(calls, ["resend:MAIN_FILE_ID", "getFileLink", "upload"]);
    assert.strictEqual(fetchCount, 1, "first view downloads the bytes once");

    calls.length = 0;
    assert.strictEqual(await replyWithProfileMedia(ctx, PROFILE, {}, mainBotTelegram), null);
    assert.deepStrictEqual(calls, ["resend:ADMIN_FILE_ID"], "second view is one call");
    assert.strictEqual(fetchCount, 1, "no second download");

    // A different admin opening the same person also pays nothing.
    calls.length = 0;
    await replyWithProfileMedia(ctx, PROFILE, {}, mainBotTelegram);
    assert.deepStrictEqual(calls, ["resend:ADMIN_FILE_ID"]);
  })();
});

run("the doomed cross-bot resend is attempted once, never again", () => {
  const { ctx, mainBotTelegram, calls } = makeWorld();
  return (async () => {
    await replyWithProfileMedia(ctx, { ...PROFILE }, {}, mainBotTelegram);
    calls.length = 0;
    // A DIFFERENT person, so the cache cannot hide the difference.
    await replyWithProfileMedia(ctx, { mediaFileId: "OTHER", mediaType: "photo" }, {}, mainBotTelegram);
    assert.ok(!calls.some((c) => c === "resend:OTHER"), `expected no doomed resend, got ${calls}`);
    assert.deepStrictEqual(calls, ["getFileLink", "upload"]);
  })();
});

// --- one-token deployment: must keep its fast path --------------------------
run("a single-token setup never downloads at all", () => {
  const { ctx, mainBotTelegram, calls } = makeWorld({ sameToken: true });
  return (async () => {
    assert.strictEqual(await replyWithProfileMedia(ctx, PROFILE, {}, mainBotTelegram), null);
    assert.deepStrictEqual(calls, ["resend:MAIN_FILE_ID"]);
    assert.strictEqual(fetchCount, 0);
  })();
});

// --- a cached id that Telegram has retired ----------------------------------
run("a stale cached id is rebuilt, not reported as a failure", () => {
  const { ctx, mainBotTelegram, calls } = makeWorld();
  return (async () => {
    await replyWithProfileMedia(ctx, PROFILE, {}, mainBotTelegram);

    // Poison the cache the only way the module allows: make the id it stored
    // start failing.
    const poisoned = { mediaFileId: "STALE_ADMIN_ID", mediaType: "photo" };
    calls.length = 0;
    const failure = await replyWithProfileMedia(ctx, poisoned, {}, mainBotTelegram);
    assert.strictEqual(failure, null, "should recover by re-uploading");
    assert.ok(calls.includes("upload"), `expected a re-upload, got ${calls}`);
  })();
});

// --- failure still reports why ----------------------------------------------
run("an unshowable file reports both reasons", () => {
  const ctx = {
    async replyWithPhoto() {
      throw new Error("boom");
    },
  };
  const mainBotTelegram = {
    async getFileLink() {
      throw new Error("file is too big");
    },
  };
  return (async () => {
    const failure = await replyWithProfileMedia(ctx, PROFILE, {}, mainBotTelegram);
    assert.match(failure, /boom/);
    assert.match(failure, /file is too big/);
  })();
});

(async () => {
  for (const t of tests) await t();
  console.log("\nall media tests passed");
})().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
