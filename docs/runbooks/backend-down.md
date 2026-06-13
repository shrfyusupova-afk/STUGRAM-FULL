# Runbook: Backend Down

## Symptoms
- `GET /livez` returns non-2xx or connection timeout
- Android app shows "network error" or cannot load feed/login
- Zero traffic in access logs for >2 minutes during expected active period
- Uptime monitor fires P0 alert

## Detection Signal
- Uptime monitor: `/livez` check fails
- Render dashboard: service shows "Crashed" or "Deploying" unexpectedly
- `http_requests_total` counter is 0 (from last scrape)

## Immediate Actions

### 1. Identify scope (< 2 min)
```bash
# Check Render service status
open https://dashboard.render.com

# Test endpoints directly
curl -f https://stugram-beckend.onrender.com/livez
curl -f https://stugram-beckend.onrender.com/readyz
```

### 2. Check recent deploys (< 1 min)
```bash
# In Render dashboard: check "Deploys" tab for a recent failed or crashed deploy
# If the last deploy is within 30 min, it's likely the cause.
```

### 3. Check application logs (< 3 min)
- Render dashboard → Logs tab → look for:
  - `Error: Cannot connect to MongoDB` → see [db-down.md](db-down.md)
  - `Error: ECONNREFUSED redis` → see [redis-down.md](redis-down.md)
  - `SyntaxError` / `ReferenceError` → code bug in last deploy
  - `SIGKILL` / OOM → memory limit hit

## Rollback Action

### If last deploy is the cause:
```bash
# Render dashboard → Deploys → previous successful deploy → "Redeploy"
# OR via Render CLI:
render deploy --service stugram-backend --commit <prev-sha>
```

### If environment variable was removed:
```bash
# Render dashboard → Environment → verify all required vars are present:
# MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OTP_SECRET,
# NODE_ENV=production
```

### If memory limit hit:
- Temporarily scale up instance type in Render dashboard.
- File ticket to profile memory leak.

## Escalation
- **5 min**: Notify team lead via Slack #incidents.
- **15 min**: If not resolved, post status update on any public status page.
- **30 min**: Escalate to Render support if the issue is infrastructure-level.

## Verification After Fix
```bash
curl -f https://stugram-beckend.onrender.com/livez   # must return 200
curl -f https://stugram-beckend.onrender.com/readyz  # must return 200
# Send a test login request to verify the full stack is operational.
```
