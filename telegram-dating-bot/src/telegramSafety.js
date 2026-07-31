// Telegram callback-query acknowledgements can transiently fail (stale
// query, "message is not modified", a brief network hiccup). When that
// happens, whatever real action the tap was actually for must still run
// instead of being silently aborted mid-handler.
async function safeAnswerCbQuery(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (err) {
    console.error("answerCbQuery failed (ignored):", err.message);
  }
}


// Two answers from Telegram that every bulk send has to tell apart, kept here
// because more than one place sends in bulk and they must agree.
//
// 403 -- "bot was blocked by the user", "user is deactivated". Not an error:
// that person is gone, and writing to them again is wasted quota forever.
function isGoneError(err) {
  const code = err?.response?.error_code ?? err?.code;
  return code === 403;
}

// 429 -- too fast. Telegram says exactly how long to wait, and reading that
// is the difference between pausing once and being throttled for an hour.
// Counting a 429 as "they blocked us" is worse still: the message is silently
// dropped AND the operator is told a comfortable lie about why.
function retryAfterMs(err) {
  const seconds = err?.response?.parameters?.retry_after ?? err?.parameters?.retry_after;
  return Number.isFinite(seconds) ? (seconds + 1) * 1000 : null;
}

module.exports = { safeAnswerCbQuery, isGoneError, retryAfterMs };
