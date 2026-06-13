/**
 * k6 load test — Auth endpoints
 *
 * Scenarios: login (POST /auth/login), token refresh (POST /auth/refresh-token)
 * Run:
 *   k6 run --env BASE_URL=https://stugram-beckend.onrender.com \
 *          --env TEST_USER=loadtest@example.com \
 *          --env TEST_PASS=LoadTest1234! \
 *          scripts/load/k6-auth.js
 *
 * Ramp stages (edit TARGET_VUS env var to override peak):
 *   50 VUs  → low-volume smoke
 *   100 VUs → nominal beta load
 *   200 VUs → stress ceiling
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("auth_errors");
const loginLatency = new Trend("auth_login_latency_ms", true);
const refreshLatency = new Trend("auth_refresh_latency_ms", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_USER = __ENV.TEST_USER || "loadtestuser";   // username or email
const TEST_PASS = __ENV.TEST_PASS || "LoadTest1234!";
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || "50", 10);

export const options = {
  stages: [
    { duration: "30s", target: Math.round(TARGET_VUS * 0.5) },
    { duration: "1m",  target: TARGET_VUS },
    { duration: "2m",  target: TARGET_VUS },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed:          ["rate<0.05"],
    auth_errors:              ["rate<0.05"],
    auth_login_latency_ms:    ["p(95)<1500", "p(99)<3000"],
    auth_refresh_latency_ms:  ["p(95)<800",  "p(99)<2000"],
  },
};

const LOGIN_URL   = `${BASE_URL}/api/v1/auth/login`;
const REFRESH_URL = `${BASE_URL}/api/v1/auth/refresh-token`;
const JSON_HEADERS = { "Content-Type": "application/json" };

export default function () {
  // --- login ---
  const loginStart = Date.now();
  const loginRes = http.post(
    LOGIN_URL,
    JSON.stringify({ identityOrUsername: TEST_USER, password: TEST_PASS }),
    { headers: JSON_HEADERS, tags: { name: "login" } }
  );
  loginLatency.add(Date.now() - loginStart);

  const loginOk = check(loginRes, {
    "login status 200": (r) => r.status === 200,
    "login has accessToken": (r) => {
      try { return !!JSON.parse(r.body).data?.accessToken; } catch { return false; }
    },
  });
  errorRate.add(!loginOk);

  if (!loginOk) {
    sleep(1);
    return;
  }

  const body = JSON.parse(loginRes.body);
  const refreshToken = body.data?.refreshToken;

  sleep(0.5);

  // --- refresh ---
  if (refreshToken) {
    const refreshStart = Date.now();
    const refreshRes = http.post(
      REFRESH_URL,
      JSON.stringify({ refreshToken }),
      { headers: JSON_HEADERS, tags: { name: "refresh" } }
    );
    refreshLatency.add(Date.now() - refreshStart);

    const refreshOk = check(refreshRes, {
      "refresh status 200": (r) => r.status === 200,
      "refresh has new accessToken": (r) => {
        try { return !!JSON.parse(r.body).data?.accessToken; } catch { return false; }
      },
    });
    errorRate.add(!refreshOk);
  }

  sleep(1);
}
