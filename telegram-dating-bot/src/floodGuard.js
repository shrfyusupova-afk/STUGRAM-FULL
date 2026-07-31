// A per-user flood guard for the MAIN bot. Nothing in this app rate-limited
// an ordinary user's updates at all: a scripted client (not the real Telegram
// app, which no user is forced to use) could fire messages/taps far faster
// than a person tapping a screen, and every handler downstream -- a database
// write on every swipe, a relay to a live anon-chat partner, a Click order
// lookup -- would run once per update with no ceiling. Telegram itself limits
// how fast WE can send (~1 msg/sec per chat, ~30/sec overall), so a large
// enough burst from one user risked our own outgoing messages (match
// notifications, candidate cards) started hitting 429s for everyone, not just
// the flooder.
//
// Deliberately simple and generous: a fixed window, not a token bucket, and a
// ceiling well above anything a real person tapping buttons would produce.
// The goal is capping a script, not policing enthusiastic swiping.
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 40;

const hits = new Map(); // userId -> { count, windowStart }
// Set once per user per window so the console isn't flooded right along with
// the requests that triggered it.
const warnedThisWindow = new Set();

function isFlooding(userId) {
  const now = Date.now();
  const entry = hits.get(userId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(userId, { count: 1, windowStart: now });
    warnedThisWindow.delete(userId);
    return false;
  }

  entry.count++;
  if (entry.count <= MAX_PER_WINDOW) return false;

  if (!warnedThisWindow.has(userId)) {
    warnedThisWindow.add(userId);
    console.warn(`Flood guard: dropping updates from ${userId} (${entry.count}+ in ${WINDOW_MS / 1000}s)`);
  }
  return true;
}

// Both maps above gain one entry per person who has ever sent an update, and
// nothing removed them: an entry was only ever overwritten when that same
// person came back. At a hundred thousand users that is a hundred thousand
// entries held forever for a window that expired days ago -- on a 512 MB
// instance, an out-of-memory kill rather than a slow leak.
//
// Sweeping is cheap because the entries are tiny and only the expired ones are
// touched. unref() so this timer alone never keeps the process alive.
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now = Date.now()) {
  let removed = 0;
  for (const [userId, entry] of hits) {
    if (now - entry.windowStart > WINDOW_MS) {
      hits.delete(userId);
      warnedThisWindow.delete(userId);
      removed++;
    }
  }
  return removed;
}

setInterval(sweep, SWEEP_INTERVAL_MS).unref();

// Registered before the stage/session middleware: dropping here means a flood
// never reaches a single handler, so it costs one Map lookup and nothing
// else -- no database read, no outgoing reply, no relay to anyone else.
function floodGuardMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  if (userId && isFlooding(userId)) return; // silently dropped, no next()
  return next();
}

module.exports = {
  floodGuardMiddleware,
  // Exposed so the sweep can be driven directly: waiting a real minute to find
  // out whether memory is reclaimed is not a test.
  __test: { sweep, size: () => hits.size, WINDOW_MS, MAX_PER_WINDOW },
};
