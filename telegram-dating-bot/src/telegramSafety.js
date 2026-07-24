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

module.exports = { safeAnswerCbQuery };
