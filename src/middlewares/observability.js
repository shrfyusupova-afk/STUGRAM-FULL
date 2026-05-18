const logger = require("../utils/logger");
const { env } = require("../config/env");
const { incrementCounter, recordLatency } = require("../services/metricsService");

// ---------------------------------------------------------------------------
// HTTP request completion logger + metrics emitter.
// Attached via app.use(logRequestCompletion) in app.js.
// ---------------------------------------------------------------------------
const logRequestCompletion = (req, res, next) => {
  res.on("finish", () => {
    if (!req.requestStartedAt) return;

    const durationMs = Number(process.hrtime.bigint() - req.requestStartedAt) / 1_000_000;
    const route = req.route?.path || req.originalUrl.split("?")[0];
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;
    const isServerError = statusCode >= 500;
    const method = req.method;

    // ---- structured log ----
    const payload = {
      requestId: req.requestId || null,
      method,
      path: route,
      statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.user?.id || null,
      errorCode: res.locals.errorCode || null,
      result: isError ? "error" : "success",
    };

    if (durationMs >= env.requestSlowMs) {
      logger.warn("Slow request detected", payload);
    } else {
      logger.info("Request completed", payload);
    }

    // ---- metrics ----
    const labels = { method, status: String(statusCode) };
    incrementCounter("http_requests_total", labels);
    if (isError) incrementCounter("http_errors_total", labels);
    if (isServerError) incrementCounter("http_server_errors_total", labels);
    if (durationMs >= env.requestSlowMs) {
      incrementCounter("http_slow_requests_total", { method });
    }

    recordLatency("http_request_duration_ms", durationMs, { method });
  });

  next();
};

module.exports = {
  logRequestCompletion,
};
