// The global jest.setup.js mocks src/config/redis with an in-memory stub.
// This test needs the REAL module to verify retry-strategy behavior, so
// we unmock it here. lazyConnect:true means no actual Redis connection is
// attempted on import, so the test runs safely without a Redis server.
jest.unmock("../../src/config/redis");

let buildRedisClientOptions;
let REDIS_RETRY_POLICY;

beforeAll(() => {
  jest.isolateModules(() => {
    ({ buildRedisClientOptions, REDIS_RETRY_POLICY } = require("../../src/config/redis"));
  });
});

describe("Redis reconnect strategy", () => {
  it("exports the expected policy name", () => {
    expect(REDIS_RETRY_POLICY).toBe("bounded-exponential-10");
  });

  it("retryStrategy returns increasing delays with exponential backoff", () => {
    const options = buildRedisClientOptions({ purpose: "shared" });
    const strategy = options.retryStrategy;
    expect(typeof strategy).toBe("function");

    const delays = [1, 2, 3, 4, 5].map(strategy);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it("retryStrategy returns null after max retries to stop reconnect loop", () => {
    const options = buildRedisClientOptions({ purpose: "shared" });
    const strategy = options.retryStrategy;
    expect(typeof strategy).toBe("function");

    const lastAllowed = strategy(10);
    const beyondMax = strategy(11);

    expect(typeof lastAllowed).toBe("number");
    expect(lastAllowed).toBeGreaterThan(0);
    expect(beyondMax).toBeNull();
  });

  it("retryStrategy caps delay at 30 seconds", () => {
    const options = buildRedisClientOptions({ purpose: "shared" });
    const strategy = options.retryStrategy;

    const highAttemptDelay = strategy(9);
    expect(highAttemptDelay).toBeLessThanOrEqual(30_000);
    expect(highAttemptDelay).toBeGreaterThan(0);
  });

  it("BullMQ client uses maxRetriesPerRequest=null as required by BullMQ", () => {
    const bullmqOptions = buildRedisClientOptions({ purpose: "bullmq" });
    expect(bullmqOptions.maxRetriesPerRequest).toBeNull();
  });

  it("shared client uses maxRetriesPerRequest=1 to fail fast on Redis commands", () => {
    const sharedOptions = buildRedisClientOptions({ purpose: "shared" });
    expect(sharedOptions.maxRetriesPerRequest).toBe(1);
  });
});
