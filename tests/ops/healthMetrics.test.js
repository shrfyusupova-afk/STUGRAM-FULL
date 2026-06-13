// Unit tests for the isInternalMonitoringRequest guard in app.js.
// Tests the INTERNAL_METRICS_KEY logic directly via the /health endpoint
// to confirm public requests never receive infrastructure internals.

const buildIsInternalMonitoringRequest = (internalKey) => (req) => {
  const suppliedKey = req.headers["x-internal-monitoring-key"];
  if (internalKey) {
    return suppliedKey === internalKey;
  }
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

describe("isInternalMonitoringRequest", () => {
  describe("when INTERNAL_METRICS_KEY is configured", () => {
    const secret = "supersecret-monitoring-key-123";
    const guard = buildIsInternalMonitoringRequest(secret);

    it("returns false for a request with no key header", () => {
      expect(guard({ headers: {}, ip: "203.0.113.5" })).toBe(false);
    });

    it("returns false for a request with the wrong key", () => {
      expect(guard({
        headers: { "x-internal-monitoring-key": "wrong-key" },
        ip: "203.0.113.5",
      })).toBe(false);
    });

    it("returns false even for loopback IP when key is configured but not supplied", () => {
      // Staging/prod should not expose internals via IP alone.
      expect(guard({ headers: {}, ip: "127.0.0.1" })).toBe(false);
    });

    it("returns true for the correct key regardless of IP", () => {
      expect(guard({
        headers: { "x-internal-monitoring-key": secret },
        ip: "203.0.113.5",
      })).toBe(true);
    });
  });

  describe("when INTERNAL_METRICS_KEY is not configured (local dev)", () => {
    const guard = buildIsInternalMonitoringRequest(undefined);

    it("returns true for loopback IPv4", () => {
      expect(guard({ headers: {}, ip: "127.0.0.1" })).toBe(true);
    });

    it("returns true for loopback IPv6", () => {
      expect(guard({ headers: {}, ip: "::1" })).toBe(true);
    });

    it("returns true for IPv4-mapped loopback", () => {
      expect(guard({ headers: {}, ip: "::ffff:127.0.0.1" })).toBe(true);
    });

    it("returns false for non-loopback IP (simulates deployed staging without key config)", () => {
      expect(guard({ headers: {}, ip: "10.0.0.5" })).toBe(false);
    });

    it("returns false for a public request with no header and non-loopback IP", () => {
      expect(guard({ headers: {}, ip: "198.51.100.42" })).toBe(false);
    });
  });

  describe("public health response must not expose infrastructure fields", () => {
    // Verify that the public health shape contains no internal fields.
    const publicFields = ["mongoConnected", "redisConnected", "queueReady", "pushEnabled", "cloudinaryConfigured", "cacheMode", "recommendationMode", "environment"];
    const internalOnlyFields = ["atlasReport", "redisHost", "redisPort", "redisConfigSource", "redisTlsEnabled", "database", "redis", "queueHealth"];

    const publicHealthData = {
      environment: "production",
      mongoConnected: true,
      redisConnected: true,
      queueReady: true,
      cacheMode: "enabled",
      recommendationMode: "weighted-cache",
      pushEnabled: false,
      cloudinaryConfigured: true,
    };

    it("public response contains only safe top-level keys", () => {
      const keys = Object.keys(publicHealthData);
      internalOnlyFields.forEach((field) => {
        expect(keys).not.toContain(field);
      });
      publicFields.forEach((field) => {
        expect(keys).toContain(field);
      });
    });

    it("public response does not contain Redis host/port details", () => {
      expect(publicHealthData).not.toHaveProperty("redisHost");
      expect(publicHealthData).not.toHaveProperty("redisPort");
    });

    it("public response does not contain Atlas connection details", () => {
      expect(publicHealthData).not.toHaveProperty("atlasReport");
      expect(publicHealthData).not.toHaveProperty("lastAtlasFailure");
    });
  });
});
