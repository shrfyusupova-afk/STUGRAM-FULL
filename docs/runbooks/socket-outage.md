# Runbook: Socket.IO Outage

## Symptoms
- Real-time messages stop delivering; users must manually refresh to see new messages
- "Reconnecting..." indicator persists in the Android app
- `socket_events_total` counter drops to 0 while traffic is expected
- Socket.IO server logs show no `connection` events

## Detection Signal
- `socket_events_total` (from `/metrics` internal endpoint) is 0 for >5 min during expected active hours
- Users report messages sending but not receiving in real time
- Android `ChatSocketManager` emits `ChatSocketEvent.Reconnected` repeatedly without stabilizing
- Server logs: repeated `connect_error` without resolution

## Architecture Note
The Socket.IO server shares the same process as the HTTP API server. A socket outage therefore usually means either:
1. The whole backend is down → see [backend-down.md](backend-down.md)
2. Socket.IO is failing specifically (auth token, CORS, or transient connection issue)
3. The load balancer / Render proxy is not routing WebSocket upgrade correctly

## Immediate Actions

### 1. Check if HTTP is working (< 1 min)
```bash
curl -f https://stugram-beckend.onrender.com/livez
```
- If this fails → see [backend-down.md](backend-down.md).
- If this returns 200 → socket issue is isolated.

### 2. Test WebSocket connectivity manually (< 2 min)
```bash
# Using wscat (npm install -g wscat)
wscat -c "wss://stugram-beckend.onrender.com/socket.io/?EIO=4&transport=websocket" \
  -H "Authorization: Bearer $TEST_TOKEN"
# Expect: 0{"sid":"...","upgrades":[],...}
```

### 3. Check CORS and proxy configuration (< 2 min)
- Render → Service settings → verify WebSocket support is enabled.
- Check `CLIENT_URL` env var matches the Android app's origin.
- Socket.IO requires HTTP upgrade; some proxy configs block it.

### 4. Check auth token expiry
- Socket connections authenticate via `auth.token`. If the token expires while connected, the socket will disconnect.
- Verify `JWT_ACCESS_EXPIRES_IN` is ≥ 15m (current default).

### 5. Check Redis for BullMQ interference
- A Redis timeout can cause queue workers to hold the event loop.
- Check Render logs for Redis-related errors alongside socket disconnect messages.

## Rollback Action

**If a recent deploy broke socket config:**
- Render dashboard → Deploys → rollback to previous deploy.

**If Render WebSocket proxy is the issue:**
- Verify Render service type is "Web Service" (not "Background Worker").
- Add `RENDER_FORCE_HTTPS=false` (temporary test only) to see if TLS upgrade is the problem.

**If socket auth is failing for all clients:**
- Check `JWT_ACCESS_SECRET` in env vars has not changed.
- If it changed (intentional rotation), all existing tokens are invalid — users must re-login.

**Android reconnect behaviour:**
- `ChatSocketManager` uses `setReconnectionAttempts(Int.MAX_VALUE)` with 1s–10s jitter.
- The socket will keep trying; once the server is fixed, clients reconnect automatically.
- No client-side action required.

## Escalation
- **5 min**: Notify team.
- **10 min**: If WebSocket probe fails, check Render status page (https://status.render.com).
- **15 min**: Open Render support ticket with WebSocket trace.

## Verification After Fix
```bash
# Re-run wscat test (see Step 2 above). Should connect and receive ping frames.
# Also verify:
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/metrics/snapshot | jq '
  .data.counters[] | select(.key | contains("socket_events"))
'
# After a few real users connect, socket_events_total should start incrementing.
```
