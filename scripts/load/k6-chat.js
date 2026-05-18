/**
 * k6 load test — Chat REST endpoints
 *
 * Tests the HTTP layer of chat (conversation list, message history, send message).
 * Socket.IO real-time path is excluded because k6 does not natively support
 * Socket.IO protocol framing; use a dedicated ws:// test or a dedicated
 * Artillery/Gatling scenario for full socket load testing.
 *
 * Pre-requisite: two seeded accounts (TEST_USER_A_TOKEN, TEST_USER_B_ID) that
 * already share a conversation (create one via the app or a seed script).
 *
 * Run:
 *   k6 run --env BASE_URL=https://stugram-beckend.onrender.com \
 *          --env TOKEN_A=<jwt-user-a> \
 *          --env TOKEN_B=<jwt-user-b> \
 *          --env CONVERSATION_ID=<mongo-id> \
 *          scripts/load/k6-chat.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate       = new Rate("chat_errors");
const listLatency     = new Trend("chat_conversations_latency_ms", true);
const messagesLatency = new Trend("chat_messages_latency_ms", true);
const sendLatency     = new Trend("chat_send_latency_ms", true);
const replayLatency   = new Trend("chat_replay_latency_ms", true);

const BASE_URL       = __ENV.BASE_URL         || "http://localhost:3000";
const TOKEN_A        = __ENV.TOKEN_A          || "";
const CONVERSATION   = __ENV.CONVERSATION_ID  || "";
const TARGET_VUS     = parseInt(__ENV.TARGET_VUS || "50", 10);

export const options = {
  stages: [
    { duration: "30s", target: Math.round(TARGET_VUS * 0.4) },
    { duration: "1m",  target: TARGET_VUS },
    { duration: "2m",  target: TARGET_VUS },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed:                ["rate<0.05"],
    chat_errors:                    ["rate<0.05"],
    chat_conversations_latency_ms:  ["p(95)<500",  "p(99)<1200"],
    chat_messages_latency_ms:       ["p(95)<600",  "p(99)<1500"],
    chat_send_latency_ms:           ["p(95)<1000", "p(99)<2500"],
    chat_replay_latency_ms:         ["p(95)<600",  "p(99)<1500"],
  },
};

const HEADERS_A = {
  "Content-Type": "application/json",
  Authorization:  `Bearer ${TOKEN_A}`,
};

const CONVERSATIONS_URL = `${BASE_URL}/api/v1/chat/conversations`;

let clientIdCounter = 0;
function nextClientId() {
  // VU-unique client ID to avoid cross-VU dedup collisions
  return `k6-vu${__VU}-iter${__ITER}-${++clientIdCounter}`;
}

export default function () {
  // --- conversation list ---
  const listStart = Date.now();
  const listRes = http.get(CONVERSATIONS_URL, {
    headers: HEADERS_A,
    tags: { name: "chat_conversations" },
  });
  listLatency.add(Date.now() - listStart);
  const listOk = check(listRes, { "conversations 200": (r) => r.status === 200 });
  errorRate.add(!listOk);

  if (!CONVERSATION) {
    sleep(1);
    return;
  }

  sleep(0.3);

  // --- message history ---
  const messagesUrl = `${BASE_URL}/api/v1/chat/conversations/${CONVERSATION}/messages`;
  const msgStart = Date.now();
  const msgRes = http.get(messagesUrl, {
    headers: HEADERS_A,
    tags: { name: "chat_messages" },
  });
  messagesLatency.add(Date.now() - msgStart);
  const msgOk = check(msgRes, {
    "messages 200": (r) => r.status === 200,
    "messages array": (r) => {
      try { return Array.isArray(JSON.parse(r.body).data?.messages); } catch { return false; }
    },
  });
  errorRate.add(!msgOk);

  sleep(0.3);

  // --- send a message ---
  const sendUrl = `${BASE_URL}/api/v1/chat/conversations/${CONVERSATION}/messages`;
  const sendStart = Date.now();
  const sendRes = http.post(
    sendUrl,
    JSON.stringify({ text: `k6 load test message ${Date.now()}`, clientId: nextClientId() }),
    { headers: HEADERS_A, tags: { name: "chat_send" } }
  );
  sendLatency.add(Date.now() - sendStart);
  const sendOk = check(sendRes, { "send 201": (r) => r.status === 201 });
  errorRate.add(!sendOk);

  sleep(0.3);

  // --- replay sync (fetch events since seq 0) ---
  const replayUrl = `${BASE_URL}/api/v1/chat/conversations/${CONVERSATION}/events?after=0&limit=50`;
  const replayStart = Date.now();
  const replayRes = http.get(replayUrl, {
    headers: HEADERS_A,
    tags: { name: "chat_replay" },
  });
  replayLatency.add(Date.now() - replayStart);
  const replayOk = check(replayRes, { "replay 200": (r) => r.status === 200 });
  errorRate.add(!replayOk);

  sleep(1);
}
