/**
 * General-purpose in-process metrics store.
 *
 * Provides counters, gauges, and a simple latency histogram suitable for
 * exporting to Prometheus text format or a JSON snapshot.
 *
 * Design constraints:
 *  - No external dependencies (no prom-client, no StatsD agent).
 *  - Survives Redis or DB outages — metrics are stored only in process memory.
 *  - Resets on process restart (ephemeral). For persistent metrics, pair with
 *    an external scraper (e.g. Render → Datadog → Grafana).
 */

// ----- counters -----
const counters = new Map(); // key → number

// ----- latency histograms -----
// Each histogram tracks: count, sum, and fixed upper-bound buckets.
const LATENCY_BUCKETS_MS = [10, 50, 100, 250, 500, 1000, 2500, 5000];
const histograms = new Map(); // name → { count, sum, buckets: Map<le, count>, labels }

const normalizeLabels = (labels = {}) =>
  Object.entries(labels)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/[^a-zA-Z0-9._:-]/g, "_")}"`)
    .join(",");

const counterKey = (name, labels) => `${name}{${normalizeLabels(labels)}}`;
const histoKey   = (name, labels) => `${name}{${normalizeLabels(labels)}}`;

// ----- counter API -----

const incrementCounter = (name, labels = {}, amount = 1) => {
  const key = counterKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + amount);
};

const getCounter = (name, labels = {}) => counters.get(counterKey(name, labels)) || 0;

// ----- histogram API -----

const recordLatency = (name, valueMs, labels = {}) => {
  const key = histoKey(name, labels);
  if (!histograms.has(key)) {
    const buckets = new Map(LATENCY_BUCKETS_MS.map((le) => [le, 0]));
    histograms.set(key, { name, labels, count: 0, sum: 0, buckets });
  }
  const h = histograms.get(key);
  h.count += 1;
  h.sum += valueMs;
  for (const le of LATENCY_BUCKETS_MS) {
    if (valueMs <= le) h.buckets.set(le, h.buckets.get(le) + 1);
  }
};

// Compute p50/p95/p99 from the bucket approximation.
const computePercentiles = (histogram, percentiles = [50, 95, 99]) => {
  const { count, buckets } = histogram;
  if (count === 0) return Object.fromEntries(percentiles.map((p) => [`p${p}`, null]));

  return Object.fromEntries(
    percentiles.map((p) => {
      const target = (p / 100) * count;
      let cumulative = 0;
      for (const [le, cnt] of buckets) {
        cumulative += cnt;
        if (cumulative >= target) return [`p${p}`, le];
      }
      return [`p${p}`, Infinity];
    })
  );
};

// ----- auth-failure counter (exported for auth middleware) -----
const recordAuthFailure = (reason) => {
  incrementCounter("auth_failures_total", { reason: reason || "unknown" });
};

// ----- socket event counter -----
const recordSocketEvent = (event, conversationId) => {
  incrementCounter("socket_events_total", { event: event || "unknown" });
};

// ----- snapshot / export -----

const getCountersSnapshot = () =>
  Array.from(counters.entries()).map(([key, value]) => ({ key, value }));

const getHistogramsSnapshot = () =>
  Array.from(histograms.entries()).map(([, h]) => ({
    name: h.name,
    labels: h.labels,
    count: h.count,
    sum: Number(h.sum.toFixed(2)),
    avg: h.count ? Number((h.sum / h.count).toFixed(2)) : null,
    ...computePercentiles(h),
  }));

const getFullSnapshot = () => ({
  counters: getCountersSnapshot(),
  histograms: getHistogramsSnapshot(),
});

// Render Prometheus text format for /metrics scraping.
const renderPrometheusText = () => {
  const lines = [];

  for (const [key, value] of counters) {
    // key is "name{labels}" — already in Prometheus label syntax
    lines.push(`${key.replace("{}", "")} ${value}`);
  }

  for (const [, h] of histograms) {
    const labelStr = normalizeLabels(h.labels);
    const prefix = h.name;
    for (const [le, cnt] of h.buckets) {
      const bucketLabels = labelStr ? `${labelStr},le="${le}"` : `le="${le}"`;
      lines.push(`${prefix}_bucket{${bucketLabels}} ${cnt}`);
    }
    const infLabels = labelStr ? `${labelStr},le="+Inf"` : `le="+Inf"`;
    lines.push(`${prefix}_bucket{${infLabels}} ${h.count}`);
    lines.push(`${prefix}_sum${labelStr ? `{${labelStr}}` : ""} ${h.sum.toFixed(2)}`);
    lines.push(`${prefix}_count${labelStr ? `{${labelStr}}` : ""} ${h.count}`);
  }

  return lines.join("\n");
};

// Reset everything — used in tests and for periodic flushing if needed.
const resetMetrics = () => {
  counters.clear();
  histograms.clear();
};

module.exports = {
  incrementCounter,
  getCounter,
  recordLatency,
  recordAuthFailure,
  recordSocketEvent,
  getCountersSnapshot,
  getHistogramsSnapshot,
  getFullSnapshot,
  renderPrometheusText,
  resetMetrics,
};
