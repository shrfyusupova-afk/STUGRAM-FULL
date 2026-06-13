# Runbook: High Error Rate

## Symptoms
- `http_server_errors_total` / `http_requests_total` > 5% over a 5-minute window
- Spike in `auth_failures_total` counter (possible credential stuffing / token replay)
- Users reporting "Server error" or blank screens in the app
- `http_slow_requests_total` spike alongside errors (often a cascade from DB/Redis)

## Detection Signal
- `/metrics` (internal) → `http_server_errors_total` rising
- Access logs show sustained stream of 500s or 503s
- Sentry (if configured) shows an error spike

## Triage: Identify Error Source (< 5 min)

### Step 1: Check error distribution
```bash
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/metrics/snapshot | jq '
  .data.counters[] | select(.key | contains("http_errors"))
'
```

### Step 2: Check application logs
Look for the most frequent error message:
- `MongoError` / `MongoServerSelectionError` → [db-down.md](db-down.md)
- `Redis ECONNREFUSED` → [redis-down.md](redis-down.md)
- `TypeError: Cannot read property` → code bug, likely recent deploy
- `ValidationError` / `CastError` → malformed request (not a server issue)
- `ApiError(500)` with `"Account migration failed"` → legacy token race condition

### Step 3: Correlate with deploys
- Was there a recent deploy? (Render dashboard → Deploys)
- Did error rate spike immediately after deploy? → likely a code regression.

## Auth Failure Spike (Credential Stuffing)

```bash
# Check auth failure rate
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/metrics/snapshot | jq '
  .data.counters[] | select(.key | contains("auth_failures"))
'
```

If `auth_failures_total` > 100/min:
1. Check if rate limiter is working: `chat_rate_limit_hit_total` should also be high.
2. If rate limiter is not triggering: verify `RATE_LIMIT_MAX` is set (not empty).
3. As emergency measure, lower `RATE_LIMIT_MAX` and `AUTHENTICATED_RATE_LIMIT_MAX` in Render env and redeploy.
4. If IP-based attack: consider adding Cloudflare or Render DDoS protection.

## Rollback Action

**If caused by a bad deploy:**
```bash
# Render dashboard → Deploys → previous deploy → Redeploy
```

**If caused by a code bug (TypeError etc.):**
```bash
git revert HEAD
git push origin main
# Render auto-deploys from main
```

**If caused by infrastructure (DB/Redis):**
- See relevant runbook above.

## Escalation
- **5 min**: Notify team if error rate > 10%.
- **10 min**: If no fix in progress, rollback last deploy.
- **20 min**: Post status update if users are affected.

## Verification After Fix
```bash
# Wait 2 min after fix, then:
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/metrics | grep http_server_errors_total
# Value should have stopped increasing.

# Also verify readyz is 200:
curl -f https://stugram-beckend.onrender.com/readyz
```
