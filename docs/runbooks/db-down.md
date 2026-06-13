# Runbook: MongoDB Down

## Symptoms
- `GET /readyz` returns 503 with `mongoConnected: false`
- Login, registration, feed, and chat all fail with 500 errors
- Logs contain `MongoNetworkError`, `MongoServerSelectionError`, or `ECONNREFUSED`
- `atlasReport` field (internal `/health`) shows connection errors

## Detection Signal
- `/readyz` returns 503
- `http_server_errors_total` spike correlating with DB-related routes
- Atlas monitoring shows connection drops or cluster event

## Immediate Actions

### 1. Check Atlas cluster health (< 2 min)
```
https://cloud.mongodb.com → your project → cluster → Metrics tab
```
Look for:
- Cluster state: PRIMARY / SECONDARY / RECOVERING
- Network bytes in/out dropped to 0
- Connections at 0

### 2. Check connection string (< 1 min)
```bash
# In Render env vars, verify MONGODB_URI is:
# mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/stugram?retryWrites=true&w=majority
# NOT localhost or a development URI
```

### 3. Check Atlas IP access list (< 1 min)
- Atlas → Network Access → verify Render's IP or `0.0.0.0/0` is allowlisted.
- Render uses dynamic IPs; `0.0.0.0/0` is required unless using Render's static outbound IPs (paid tier).

### 4. Check Atlas maintenance window
- Atlas → Cluster → Maintenance → check for scheduled maintenance during the outage window.

### 5. Check free tier limits (M0/M2)
- Atlas free tier has 512MB storage and connection limits.
- If storage is full, writes fail.
- Check: Atlas → Metrics → Storage.

## Rollback Action

**If Atlas maintenance caused the outage:**
- Wait for Atlas to complete maintenance (usually < 30 min).
- The application will automatically reconnect (bounded exponential backoff, max 10 retries).

**If storage is full:**
```bash
# Emergency: run the cleanup script (removes old audit logs and orphaned records)
node src/scripts/runMaintenanceCleanup.js
```

**If connection string is wrong:**
- Update `MONGODB_URI` in Render env vars.
- Trigger a redeploy.

**If ALLOW_MEMORY_DB_FALLBACK is available (dev/staging only):**
```bash
# Set in Render env vars — NOT for production; loses all writes.
ALLOW_MEMORY_DB_FALLBACK=true
```

## Escalation
- **5 min**: Notify DBA / team lead.
- **15 min**: Open Atlas support ticket if cluster is unresponsive.
- **30 min**: Consider pointing MONGODB_URI at a replica cluster if one exists.

## Verification After Fix
```bash
curl -f https://stugram-beckend.onrender.com/readyz
# response must include: "mongoConnected":true
```

Check internal health for Atlas report:
```bash
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/health | jq '.data.atlasReport'
```
