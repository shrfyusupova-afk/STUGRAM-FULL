const express = require("express");
const { Telegraf } = require("telegraf");
const crypto = require("crypto");
const { parseRequest, fetchVideo, DownloadRefused } = require("./downloader");
const { START_TEXT, NO_LINK_TEXT, DOWNLOADING_TEXT, refusalText } = require("./messages");

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN is not set -- refusing to start.");
  process.exit(1);
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply(START_TEXT));
bot.help((ctx) => ctx.reply(START_TEXT));

// Only one request handled at a time PER PERSON -- a second link pasted
// while the first is still downloading would otherwise spawn a second
// yt-dlp process for the same user, doubling the load on one instance for
// no benefit to them (they still only get the videos one at a time anyway).
const busy = new Set();

bot.on("text", async (ctx) => {
  const request = parseRequest(ctx.message.text);
  if (!request) {
    await ctx.reply(NO_LINK_TEXT);
    return;
  }

  const userId = ctx.from.id;
  if (busy.has(userId)) {
    await ctx.reply("⏳ Avvalgi so'rovingiz hali tugamadi, biroz kuting.");
    return;
  }
  busy.add(userId);

  await ctx.reply(DOWNLOADING_TEXT);
  await ctx.sendChatAction("upload_video").catch(() => {});

  let result;
  try {
    result = await fetchVideo(request.url);
  } catch (err) {
    if (err instanceof DownloadRefused) {
      await ctx.reply(refusalText(err.reasonKey, err.detail));
    } else {
      console.error(`Unexpected download failure for ${request.url}:`, err);
      await ctx.reply(refusalText("failed"));
    }
    busy.delete(userId);
    return;
  }

  try {
    await ctx.replyWithVideo(
      { source: result.filePath },
      result.title ? { caption: result.title.slice(0, 1024) } : undefined
    );
  } catch (err) {
    console.error(`Sending the video failed for ${request.url}:`, err.message);
    await ctx.reply(refusalText("failed")).catch(() => {});
  } finally {
    result.cleanup();
    busy.delete(userId);
  }
});

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

// --- startup -------------------------------------------------------------

const webhookDomain = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_DOMAIN;
const port = process.env.PORT || 3000;
const webhookPath = "/telegram/webhook";

// Telegram's secret_token only allows A-Z a-z 0-9 _ - . Render's
// generateValue emits base64, which contains + / = -- passing that straight
// through would make setWebhook fail with "secret token contains unallowed
// characters" on every boot, with the bot receiving nothing while /health
// still says everything is fine. Hashing a non-conforming value into one
// that fits keeps it usable without needing a second, hand-picked secret.
const SECRET_TOKEN_OK = /^[A-Za-z0-9_-]{1,256}$/;
function usableWebhookSecret(raw) {
  if (!raw) return crypto.randomBytes(32).toString("hex");
  if (SECRET_TOKEN_OK.test(raw)) return raw;
  console.warn(
    "WEBHOOK_SECRET contains characters Telegram does not allow in secret_token " +
      "(only A-Z a-z 0-9 _ - are permitted) -- using a hash of it instead. " +
      "The value still works; set a conforming one to silence this warning."
  );
  return crypto.createHash("sha256").update(raw).digest("hex");
}

let webhookSecret = process.env.WEBHOOK_SECRET;
if (webhookDomain) {
  if (!webhookSecret) {
    console.warn(
      "WEBHOOK_SECRET was not set -- auto-generated a random one for this run. " +
        "Set it explicitly in your environment so it survives a restart."
    );
  }
  webhookSecret = usableWebhookSecret(webhookSecret);
}

if (webhookDomain) {
  const app = express();
  app.set("trust proxy", 1);

  app.get("/health", (req, res) =>
    res.status(200).json({ status: "ok", commit: process.env.RENDER_GIT_COMMIT || "unknown" })
  );

  app.use(
    bot.webhookCallback(webhookPath, webhookSecret ? { secretToken: webhookSecret } : undefined)
  );

  app.listen(port, () => {
    console.log(`video-downloader-bot listening on :${port}`);
    bot.telegram
      .setWebhook(`${webhookDomain}${webhookPath}`, webhookSecret ? { secret_token: webhookSecret } : undefined)
      .then(() => console.log(`Webhook set to ${webhookDomain}${webhookPath}`))
      .catch((err) => console.error("setWebhook failed:", err.message));
  });
} else {
  bot
    .launch()
    .then(() => console.log("video-downloader-bot ishga tushdi (long polling, domen sozlanmagan)."))
    .catch((err) => {
      // Without this, a bad token or a Telegram outage at startup is an
      // unhandled promise rejection -- Node prints a raw stack trace and
      // exits with a misleading code, instead of the one-line reason an
      // operator actually needs.
      console.error("Bot failed to start:", err.message);
      process.exit(1);
    });
}

// bot.stop() only makes sense after bot.launch() (long-polling mode) --
// in webhook mode the bot was never "launched" in telegraf's sense (Express
// owns the HTTP server instead), and calling stop() there throws "Bot is not
// running!" instead of shutting down, which is the opposite of what a
// deploy's SIGTERM is asking for.
function shutdown(signal) {
  if (webhookDomain) {
    process.exit(0);
    return;
  }
  // bot.stop() itself throws "Bot is not running!" if the signal lands
  // before launch()'s getMe call has resolved -- a real race, not a
  // hypothetical one, since Render can send SIGTERM within the first second
  // of a redeploy. A crash on the way OUT is exactly as bad as one on the
  // way in.
  try {
    bot.stop(signal);
  } catch (err) {
    console.warn(`bot.stop() during shutdown (ignored): ${err.message}`);
  }
  process.exit(0);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
