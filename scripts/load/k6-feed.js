/**
 * k6 load test — Feed & profile endpoints
 *
 * Scenarios: GET /feed (cursor pagination), GET /users/:username/profile,
 *            GET /posts/:id
 *
 * Pre-requisite: set TEST_TOKEN to a valid JWT from a seeded load-test account.
 *
 * Run:
 *   k6 run --env BASE_URL=https://stugram-beckend.onrender.com \
 *          --env TEST_TOKEN=<jwt> \
 *          --env TEST_USERNAME=loadtest \
 *          scripts/load/k6-feed.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate   = new Rate("feed_errors");
const feedLatency = new Trend("feed_latency_ms", true);
const profLatency = new Trend("profile_latency_ms", true);
const postLatency = new Trend("post_latency_ms", true);

const BASE_URL      = __ENV.BASE_URL     || "http://localhost:3000";
const TOKEN         = __ENV.TEST_TOKEN   || "";
const TEST_USERNAME = __ENV.TEST_USERNAME || "loadtest";
const TARGET_VUS    = parseInt(__ENV.TARGET_VUS || "100", 10);

export const options = {
  stages: [
    { duration: "30s", target: Math.round(TARGET_VUS * 0.25) },
    { duration: "1m",  target: Math.round(TARGET_VUS * 0.5) },
    { duration: "2m",  target: TARGET_VUS },
    { duration: "1m",  target: TARGET_VUS },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed:    ["rate<0.05"],
    feed_errors:        ["rate<0.05"],
    feed_latency_ms:    ["p(50)<300", "p(95)<1000", "p(99)<2500"],
    profile_latency_ms: ["p(50)<200", "p(95)<700",  "p(99)<1500"],
    post_latency_ms:    ["p(50)<200", "p(95)<700",  "p(99)<1500"],
  },
};

const HEADERS = {
  "Content-Type":  "application/json",
  Authorization:   `Bearer ${TOKEN}`,
};

const FEED_URL    = `${BASE_URL}/api/v1/posts/feed/me`;
const PROFILE_URL = `${BASE_URL}/api/v1/profiles/${TEST_USERNAME}/summary`;

export default function () {
  // --- feed page 1 ---
  const feedStart = Date.now();
  const feedRes = http.get(FEED_URL, { headers: HEADERS, tags: { name: "feed_p1" } });
  feedLatency.add(Date.now() - feedStart);

  const feedOk = check(feedRes, {
    "feed 200": (r) => r.status === 200,
    "feed has posts array": (r) => {
      try { return Array.isArray(JSON.parse(r.body).data?.posts); } catch { return false; }
    },
  });
  errorRate.add(!feedOk);

  // cursor pagination: fetch page 2 if cursor is available
  if (feedOk) {
    try {
      const parsed = JSON.parse(feedRes.body);
      const cursor = parsed.data?.nextCursor || parsed.data?.posts?.[parsed.data.posts.length - 1]?.createdAt;
      if (cursor) {
        const feedP2Start = Date.now();
        const feedP2Res = http.get(`${FEED_URL}?before=${encodeURIComponent(cursor)}`, {
          headers: HEADERS,
          tags: { name: "feed_p2" },
        });
        feedLatency.add(Date.now() - feedP2Start);
        const feedP2Ok = check(feedP2Res, { "feed page 2 200": (r) => r.status === 200 });
        errorRate.add(!feedP2Ok);
      }
    } catch (_) { /* ignore parse errors */ }
  }

  sleep(0.5);

  // --- profile ---
  const profStart = Date.now();
  const profRes = http.get(PROFILE_URL, { headers: HEADERS, tags: { name: "profile" } });
  profLatency.add(Date.now() - profStart);
  const profOk = check(profRes, { "profile 200": (r) => r.status === 200 });
  errorRate.add(!profOk);

  // --- single post fetch (use first post from feed if available) ---
  if (feedOk) {
    try {
      const posts = JSON.parse(feedRes.body).data?.posts;
      const postId = posts?.[0]?._id;
      if (postId) {
        const postStart = Date.now();
        const postRes = http.get(`${BASE_URL}/api/v1/posts/${postId}`, {
          headers: HEADERS,
          tags: { name: "post_detail" },
        });
        postLatency.add(Date.now() - postStart);
        const postOk = check(postRes, { "post detail 200": (r) => r.status === 200 });
        errorRate.add(!postOk);
      }
    } catch (_) { /* ignore */ }
  }

  sleep(1);
}
