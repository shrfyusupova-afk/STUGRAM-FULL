# Alerting Reference

This document lists the signals, thresholds, and runbook pointers for every alert category. All alerts assume an external uptime monitor (e.g. Better Uptime, UptimeRobot, Render's built-in checks, or Datadog) is configured to scrape `/readyz` and internal `/metrics`.

## Alert Definitions

| Alert | Condition | Severity | Runbook |
|-------|-----------|----------|---------|
| Backend Down | `/livez` returns non-2xx or times out >10 s | P0 | [backend-down.md](runbooks/backend-down.md) |
| MongoDB Down | `/readyz` → `mongoConnected: false` OR 503 | P0 | [db-down.md](runbooks/db-down.md) |
| Redis Down | `/readyz` → `redisConnected: false` | P1 | [redis-down.md](runbooks/redis-down.md) |
| High Error Rate | `http_server_errors_total` > 5% of `http_requests_total` over 5 min | P1 | [high-error-rate.md](runbooks/high-error-rate.md) |
| Socket Outage | `socket_events_total` drops to 0 for >5 min while traffic is active | P1 | [socket-outage.md](runbooks/socket-outage.md) |
| Cloudinary Failure | `/health` → `cloudinaryConfigured: false` or upload 500 rate > 5% | P2 | [cloudinary-failure.md](runbooks/cloudinary-failure.md) |
| High Auth Failure Rate | `auth_failures_total` > 100/min (possible credential stuffing) | P1 | [high-error-rate.md](runbooks/high-error-rate.md) |
| Slow Requests | `http_slow_requests_total` > 20/min | P2 | [high-error-rate.md](runbooks/high-error-rate.md) |
| Rate Limit Saturation | `chat_rate_limit_hit_total` > 500/min | P2 | [backend-down.md](runbooks/backend-down.md) |

## Monitoring Endpoints

| Endpoint | Access | Purpose |
|----------|--------|---------|
| `GET /livez` | Public | Liveness probe — returns 200 if process is alive |
| `GET /readyz` | Public | Readiness probe — 200 when DB+Redis+queue are ready |
| `GET /health` | Public (limited) / Internal (full) | Health details |
| `GET /metrics` | Internal only (`X-Internal-Monitoring-Key`) | Prometheus counters + histograms |
| `GET /metrics/chat` | Internal only | Chat-specific Prometheus metrics |
| `GET /metrics/snapshot` | Internal only | JSON snapshot of all metrics |
| `GET /health/chat-observability` | Internal only | Chat metrics JSON |
| `GET /health/push` | Internal only | Push notification readiness |

## Alert Thresholds (recommended initial values)

These are conservative starting points. Tune after observing actual production traffic.

```
Error rate P0 threshold:    ≥ 10% server errors (5xx) over 5 min
Error rate P1 threshold:    ≥ 5%  server errors (5xx) over 5 min
Latency P0 threshold:       p99 > 5000ms over 5 min
Latency P1 threshold:       p95 > 2000ms over 5 min
Auth failure rate:           > 100/min
Rate limit hit rate:         > 500/min
Uptime SLO (beta):           99.0% monthly (allows ~7.3 h downtime)
Uptime SLO (production):     99.9% monthly (allows ~44 min downtime)
```

## Notification Channels

Configure at least two channels with escalation:
1. **Slack #alerts** — P1 and P0 immediate notification
2. **PagerDuty / SMS** — P0 only, with 5-min escalation if unacknowledged
3. **Email digest** — P2, daily summary

## Silence Windows

When deploying:
1. Silence all P1/P2 alerts for 15 minutes post-deploy.
2. Keep P0 alerts (down/data-loss) active at all times — do not silence.
3. After silence window, verify metrics have returned to baseline before closing.
