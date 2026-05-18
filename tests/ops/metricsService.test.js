// Unit tests for the general-purpose metricsService.
// These cover counter increments, latency histograms, p50/p95/p99 approximation,
// and Prometheus text rendering. No HTTP server required.

const {
  incrementCounter,
  getCounter,
  recordLatency,
  recordAuthFailure,
  getCountersSnapshot,
  getHistogramsSnapshot,
  renderPrometheusText,
  resetMetrics,
} = require("../../src/services/metricsService");

beforeEach(() => {
  resetMetrics();
});

describe("counter operations", () => {
  it("starts at zero for an unseen counter", () => {
    expect(getCounter("never_seen_total")).toBe(0);
  });

  it("increments by 1 by default", () => {
    incrementCounter("req_total", { method: "GET" });
    expect(getCounter("req_total", { method: "GET" })).toBe(1);
  });

  it("increments by a supplied amount", () => {
    incrementCounter("req_total", { method: "POST" }, 5);
    expect(getCounter("req_total", { method: "POST" })).toBe(5);
  });

  it("accumulates across multiple calls", () => {
    incrementCounter("req_total", { method: "GET" });
    incrementCounter("req_total", { method: "GET" });
    incrementCounter("req_total", { method: "GET" });
    expect(getCounter("req_total", { method: "GET" })).toBe(3);
  });

  it("treats different label sets as distinct counters", () => {
    incrementCounter("req_total", { method: "GET" });
    incrementCounter("req_total", { method: "POST" });
    expect(getCounter("req_total", { method: "GET" })).toBe(1);
    expect(getCounter("req_total", { method: "POST" })).toBe(1);
  });
});

describe("auth failure helper", () => {
  it("increments auth_failures_total with reason label", () => {
    recordAuthFailure("token_has_been_revoked");
    const snapshot = getCountersSnapshot();
    const entry = snapshot.find((c) => c.key.includes("auth_failures_total"));
    expect(entry).toBeTruthy();
    expect(entry.value).toBe(1);
    expect(entry.key).toContain("token_has_been_revoked");
  });

  it("defaults reason to unknown when undefined", () => {
    recordAuthFailure(undefined);
    const snapshot = getCountersSnapshot();
    const entry = snapshot.find((c) => c.key.includes("auth_failures_total"));
    expect(entry?.key).toContain("unknown");
  });
});

describe("latency histogram", () => {
  it("records count and sum", () => {
    recordLatency("http_request_duration_ms", 120, { method: "GET" });
    recordLatency("http_request_duration_ms", 80, { method: "GET" });

    const snapshots = getHistogramsSnapshot();
    const h = snapshots.find((s) => s.name === "http_request_duration_ms");
    expect(h).toBeTruthy();
    expect(h.count).toBe(2);
    expect(h.sum).toBe(200);
    expect(h.avg).toBe(100);
  });

  it("p50 is at or below the median sample", () => {
    // 10 samples: 5 at 50ms, 5 at 500ms → p50 should be ≤ 500ms
    for (let i = 0; i < 5; i++) recordLatency("latency_test", 50, {});
    for (let i = 0; i < 5; i++) recordLatency("latency_test", 500, {});
    const h = getHistogramsSnapshot().find((s) => s.name === "latency_test");
    expect(h.p50).toBeLessThanOrEqual(500);
    expect(h.p50).toBeGreaterThan(0);
  });

  it("p99 is at or above p50", () => {
    for (let i = 0; i < 99; i++) recordLatency("p99_test", 10, {});
    recordLatency("p99_test", 5000, {});
    const h = getHistogramsSnapshot().find((s) => s.name === "p99_test");
    expect(h.p99).toBeGreaterThanOrEqual(h.p50);
  });
});

describe("Prometheus text rendering", () => {
  it("renders counters in Prometheus line format", () => {
    incrementCounter("http_requests_total", { method: "GET", status: "200" });
    const output = renderPrometheusText();
    expect(output).toMatch(/http_requests_total/);
    expect(output).toMatch(/method="GET"/);
    expect(output).toMatch(/ 1$/m);
  });

  it("renders histogram buckets, sum, and count", () => {
    recordLatency("http_request_duration_ms", 75, { method: "GET" });
    const output = renderPrometheusText();
    expect(output).toMatch(/http_request_duration_ms_bucket/);
    expect(output).toMatch(/http_request_duration_ms_sum/);
    expect(output).toMatch(/http_request_duration_ms_count/);
    expect(output).toMatch(/le="100"/); // 75ms falls in the ≤100ms bucket
  });

  it("does not emit internal infra secrets in rendered output", () => {
    incrementCounter("http_requests_total", { method: "GET" });
    const output = renderPrometheusText();
    // Verify no MongoDB URI or Redis credentials appear in metrics output.
    expect(output).not.toMatch(/mongodb/i);
    expect(output).not.toMatch(/redis/i);
    expect(output).not.toMatch(/password/i);
    expect(output).not.toMatch(/secret/i);
  });
});

describe("resetMetrics", () => {
  it("clears all counters and histograms", () => {
    incrementCounter("test_counter", {});
    recordLatency("test_latency", 50, {});
    resetMetrics();
    expect(getCountersSnapshot()).toHaveLength(0);
    expect(getHistogramsSnapshot()).toHaveLength(0);
  });
});
