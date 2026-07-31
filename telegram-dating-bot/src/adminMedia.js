// Getting an anketa photo from the MAIN bot onto a card in the ADMIN bot.
//
// Telegram file ids belong to the bot that received them. The photo is
// uploaded to the main bot, so the admin bot -- a separate bot with its own
// token -- gets "wrong file identifier" when it tries to resend that id, and
// the card silently came out as text with no photo. Everything here exists to
// get the actual bytes across that boundary, and then to never pay for the
// crossing twice.

// getFile caps downloads at 20 MB, which a long anketa video can exceed; that
// case reports itself rather than disappearing.
const MEDIA_FETCH_TIMEOUT_MS = 20000;

async function fetchProfileMedia(mainBotTelegram, fileId) {
  const link = await mainBotTelegram.getFileLink(fileId);
  const res = await fetch(String(link), { signal: AbortSignal.timeout(MEDIA_FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`fayl yuklab olinmadi (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Every upload Telegram accepts comes back with a file id belonging to THIS
// bot, and that id can be resent forever with a single JSON call. Not keeping
// it meant every look at the same person re-ran the whole download and
// re-upload -- the same bytes fetched and pushed again, for a file Telegram
// already had. Keyed by the main bot's id, capped so a long admin session
// cannot grow it without bound.
const MAX_CACHED_MEDIA_IDS = 500;
const adminMediaIds = new Map();

function rememberAdminMediaId(mainFileId, adminFileId) {
  if (!mainFileId || !adminFileId) return;
  // Re-inserting moves the key to the end, so the eviction below drops the
  // least recently used rather than whichever happened to be stored first.
  adminMediaIds.delete(mainFileId);
  adminMediaIds.set(mainFileId, adminFileId);
  if (adminMediaIds.size > MAX_CACHED_MEDIA_IDS) {
    adminMediaIds.delete(adminMediaIds.keys().next().value);
  }
}

// Telegram returns a photo in several sizes, largest last; that is the one
// worth caching.
function sentMediaFileId(message) {
  if (message?.photo?.length) return message.photo[message.photo.length - 1].file_id;
  return message?.video?.file_id || message?.document?.file_id || null;
}

// Whether a file id from the main bot can be resent by this one. True only
// when both run on the SAME token, and false for every normal two-token
// deployment -- where the attempt is a guaranteed failed round trip to
// Telegram on every single card. Learned from the first answer rather than
// assumed, so a single-token setup keeps its fast path.
let directResendWorks = null;

// Returns null on success, or the reason the media could not be shown.
async function replyWithProfileMedia(ctx, profile, extra, mainBotTelegram) {
  const method = profile.mediaType === "video" ? "replyWithVideo" : "replyWithPhoto";

  const cached = adminMediaIds.get(profile.mediaFileId);
  if (cached) {
    try {
      await ctx[method](cached, extra);
      return null;
    } catch {
      // Telegram can retire a file id. Drop it and rebuild below rather than
      // reporting a failure the next attempt would have fixed.
      adminMediaIds.delete(profile.mediaFileId);
    }
  }

  let directError = "boshqa botning file_id'si";
  if (directResendWorks !== false) {
    try {
      const sent = await ctx[method](profile.mediaFileId, extra);
      directResendWorks = true;
      rememberAdminMediaId(profile.mediaFileId, sentMediaFileId(sent));
      return null;
    } catch (err) {
      directError = err.message;
      directResendWorks = false;
    }
  }

  if (!mainBotTelegram) return directError;

  try {
    const buffer = await fetchProfileMedia(mainBotTelegram, profile.mediaFileId);
    const sent = await ctx[method]({ source: buffer }, extra);
    rememberAdminMediaId(profile.mediaFileId, sentMediaFileId(sent));
    return null;
  } catch (err) {
    return `${directError} → ${err.message}`;
  }
}

// Lets a test start from a known state; nothing in the running bot calls it.
function resetMediaCache() {
  adminMediaIds.clear();
  directResendWorks = null;
}

module.exports = {
  fetchProfileMedia,
  replyWithProfileMedia,
  resetMediaCache,
  MAX_CACHED_MEDIA_IDS,
};
