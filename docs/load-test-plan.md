# Load Test Plan — StuGram Beta

## Overview

Three k6 script targets: auth, feed, and chat REST endpoints. Socket.IO real-time
path is not covered by k6 (it does not support the Socket.IO framing protocol);
use Artillery or Gatling for full WebSocket load testing if needed.

---

## Prerequisites

```bash
# Install k6 (macOS)
brew install k6
# or Docker
docker pull grafana/k6

# Seed a load-test user account first (avoid polluting real user data)
# Set env vars before running any script:
export BASE_URL=https://stugram-beckend.onrender.com
export TEST_TOKEN=$(curl -s -X POST $BASE_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identity":"loadtest@example.com","password":"LoadTest1234!"}' \
  | jq -r '.data.accessToken')
```

---

## Test Scenarios

### 1. Auth — `scripts/load/k6-auth.js`

| Stage | VUs | Duration |
|-------|-----|----------|
| Ramp-up | 0 → 25 | 30 s |
| Nominal | 50 | 1 min |
| Sustained | 50 | 2 min |
| Ramp-down | 50 → 0 | 30 s |

Endpoints exercised:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`

```bash
# Smoke (50 VUs)
k6 run --env BASE_URL=$BASE_URL \
       --env TEST_USER=loadtest@example.com \
       --env TEST_PASS=LoadTest1234! \
       scripts/load/k6-auth.js

# Nominal (100 VUs)
k6 run --env TARGET_VUS=100 --env BASE_URL=$BASE_URL \
       --env TEST_USER=loadtest@example.com \
       --env TEST_PASS=LoadTest1234! \
       scripts/load/k6-auth.js

# Stress (200 VUs)
k6 run --env TARGET_VUS=200 --env BASE_URL=$BASE_URL \
       --env TEST_USER=loadtest@example.com \
       --env TEST_PASS=LoadTest1234! \
       scripts/load/k6-auth.js
```

**Pass criteria:**
- `http_req_failed < 5%`
- Login p95 < 1500 ms, p99 < 3000 ms
- Refresh p95 < 800 ms, p99 < 2000 ms

---

### 2. Feed & Profile — `scripts/load/k6-feed.js`

| Stage | VUs | Duration |
|-------|-----|----------|
| Ramp-up | 0 → 25 | 30 s |
| Ramp | 25 → 50 | 1 min |
| Nominal | 100 | 2 min |
| Sustained | 100 | 1 min |
| Ramp-down | 100 → 0 | 30 s |

Endpoints exercised:
- `GET /api/v1/posts/feed` (page 1)
- `GET /api/v1/posts/feed?before=<cursor>` (page 2)
- `GET /api/v1/users/:username` (profile)
- `GET /api/v1/posts/:id` (single post)

```bash
k6 run --env BASE_URL=$BASE_URL \
       --env TEST_TOKEN=$TEST_TOKEN \
       --env TEST_USERNAME=loadtest \
       --env TARGET_VUS=100 \
       scripts/load/k6-feed.js
```

**Pass criteria:**
- `http_req_failed < 5%`
- Feed p50 < 300 ms, p95 < 1000 ms, p99 < 2500 ms
- Profile p95 < 700 ms
- Post detail p95 < 700 ms

---

### 3. Chat REST — `scripts/load/k6-chat.js`

| Stage | VUs | Duration |
|-------|-----|----------|
| Ramp-up | 0 → 20 | 30 s |
| Nominal | 50 | 2 min |
| Ramp-down | 50 → 0 | 30 s |

Endpoints exercised:
- `GET /api/v1/chat/conversations`
- `GET /api/v1/chat/conversations/:id/messages`
- `POST /api/v1/chat/conversations/:id/messages`
- `GET /api/v1/chat/conversations/:id/events?after=0`

```bash
# Get conversation ID from your seeded account
export CONV_ID=<mongo-id>
k6 run --env BASE_URL=$BASE_URL \
       --env TOKEN_A=$TEST_TOKEN \
       --env CONVERSATION_ID=$CONV_ID \
       --env TARGET_VUS=50 \
       scripts/load/k6-chat.js
```

**Pass criteria:**
- `http_req_failed < 5%`
- Send p95 < 1000 ms, p99 < 2500 ms
- Message list p95 < 600 ms
- Replay sync p95 < 600 ms

---

## Load Levels

| Level | VUs | Purpose |
|-------|-----|---------|
| Smoke | 50 | CI gate — verify nothing is broken |
| Nominal | 100 | Expected beta peak load |
| Stress | 200 | Find the breaking point |

For beta launch with < 1 000 registered users, the 100 VU nominal test is the
primary gate. 200 VU stress is informational only.

---

## Metrics to Capture

From k6 summary output:

| Metric | Target |
|--------|--------|
| `http_req_duration` p50 | < 300 ms (feed/profile) |
| `http_req_duration` p95 | < 1000 ms (feed), < 800 ms (auth refresh) |
| `http_req_duration` p99 | < 2500 ms all |
| `http_req_failed` rate | < 5% |
| `iterations` | ≥ expected VU × duration / think time |

From backend `/metrics/snapshot` during the test:

```bash
# Poll during k6 run (separate terminal)
watch -n 10 'curl -s -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  $BASE_URL/metrics/snapshot | jq ".data.histograms"'
```

---

## Running Against Staging Only

**Never run the 200 VU stress test against production.** Use a staging Render
service pointing at a separate Atlas cluster.

To create a staging environment:
1. Duplicate the backend Render service → "stugram-backend-staging"
2. Point at a separate Atlas cluster (or Atlas M0 free tier for load testing)
3. Set `NODE_ENV=staging`, `MONGODB_URI=<staging-uri>`
4. Run k6 against the staging URL

---

## Interpreting Results

```
✓ http_req_failed.............: 0.12%   ✓ 3 ✗ 2495
✓ auth_login_latency_ms.......: avg=312ms p(95)=891ms p(99)=1243ms
```

- If p99 > threshold → check Atlas Atlas metrics for slow queries
- If error rate > 1% → check Render logs for 5xx causes
- If rate limiter hits → `chat_rate_limit_hit_total` counter will be > 0 in `/metrics/snapshot`

---

## Recording Results

Document each run in this table:

| Date | Script | VUs | p50 | p95 | p99 | Error rate | Pass? | Notes |
|------|--------|-----|-----|-----|-----|------------|-------|-------|
| — | — | — | — | — | — | — | — | Baseline: not yet run |

Run results before public launch and after any major infrastructure change.
