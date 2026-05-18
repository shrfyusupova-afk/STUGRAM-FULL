# Runbook: Redis Down

## Symptoms
- `GET /readyz` returns `redisConnected: false`
- Rate limiting stops enforcing (falls back to memory or allows all requests)
- Chat events may not be rate-limited
- Logs contain: `Redis connection error`, `ECONNREFUSED`, `max retries reached`

## Detection Signal
- `/readyz` → `redisConnected: false`
- Internal `/health` → `redis.connected: false`
- `http_requests_total` may spike if rate limiting is degraded
- Log messages: `Redis reconnect attempt X` → eventually `Redis exhausted max reconnect retries`

## Impact Assessment

| If `REDIS_REQUIRED=true` | If `REDIS_REQUIRED=false` (default) |
|--------------------------|--------------------------------------|
| `/readyz` returns 503 — service degraded | App continues without rate limiting |
| Auth token revocation not enforced | Auth token revocation not enforced |
| Rate limits not enforced | Rate limits not enforced |

## Immediate Actions

### 1. Check Redis provider status (< 2 min)
- If using **Render Redis**: Render dashboard → Redis instance → check status.
- If using **Upstash**: Upstash dashboard → check usage/status.
- If using **Redis Labs**: check their status page.

### 2. Check connection string (< 1 min)
```bash
# In Render env vars, verify:
# REDIS_URL=redis://... or rediss://... (TLS)
# REDIS_TLS_ENABLED=true if using TLS
```

### 3. Check memory and eviction
- Redis free tiers have memory limits. When exceeded, writes fail.
- Check eviction policy: should be `noeviction` (for BullMQ queues) or `allkeys-lru`.
- Render Redis → Metrics → Memory Usage.

### 4. Allow graceful degraded mode
The application has been designed to degrade gracefully when `REDIS_REQUIRED=false`:
- Rate limiting is non-enforcing (all requests pass).
- Token revocation is not checked.
- Chat metrics in Redis may be lost.

This is acceptable for short outages (<30 min) during beta.

## Rollback Action

**If Redis is restarting (transient):**
- The reconnect strategy will retry up to 10 times with exponential backoff (max 30 s delay).
- Wait 5 minutes; the app should reconnect automatically.
- Check logs for `Redis reconnected successfully`.

**If Redis instance is terminated (Render free tier reclaim):**
- Re-create the Redis instance in Render.
- Update `REDIS_URL` in backend env vars.
- Redeploy the backend.

**If BullMQ queue is stuck after Redis recovery:**
```bash
# Flush the stuck queue (loses pending jobs)
# Only do this if the queue is confirmed wedged.
node -e "
const { Queue } = require('bullmq');
const q = new Queue('recommendation-refresh', { connection: { url: process.env.REDIS_URL } });
q.drain(true).then(() => { console.log('Queue drained'); process.exit(0); });
"
```

## Escalation
- **5 min**: Notify team if rate limiting is down (security risk if under attack).
- **15 min**: Escalate to Redis provider support.
- **30 min**: Consider temporarily setting `REDIS_REQUIRED=false` and deploying to keep app running.

## Verification After Fix
```bash
curl -f https://stugram-beckend.onrender.com/readyz
# response must include: "redisConnected":true

curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/health | jq '.data.redis'
```
