# Production Candidate Gate

**Status as of Phase 4 completion: BETA-READY / NOT YET PRODUCTION**

Readiness score: **~90%** (target for public production launch: 100%)

---

## Gate Checklist

### CI / CD

| Item | Status | Evidence |
|------|--------|---------|
| Backend CI pipeline (Node 20 + 22 matrix, npm test) | ✅ Done | `.github/workflows/backend-ci.yml` |
| Android CI (unit tests + debug build) | ✅ Done | `.github/workflows/android-ci.yml` |
| Android release build check (conditional on secrets) | ✅ Done | `android-ci.yml` `release-build-check` job |
| Automated test coverage upload | ✅ Done | `backend-ci.yml` coverage artifact |
| Merge to main blocked without green CI | ⚠️ Partial | Branch protection must be enabled manually in GitHub → Settings → Branches |

### Release Build

| Item | Status | Evidence |
|------|--------|---------|
| `assembleDebug` passes | ✅ Verified | Phase 4 verification run |
| `assembleRelease` intentionally blocked | ✅ Correct | `checkGoogleClientId` guard (Phase 1 guard) |
| Signing config reads from env/local.properties | ✅ Done | `app/build.gradle.kts` `resolveSigningProp()` |
| `GOOGLE_WEB_CLIENT_ID` set for release | ❌ Blocker | Must be set before Play Store submission |

### Monitoring & Observability

| Item | Status | Evidence |
|------|--------|---------|
| Prometheus-format `/metrics` endpoint | ✅ Done | `src/app.js`, `src/services/metricsService.js` |
| JSON `/metrics/snapshot` endpoint | ✅ Done | Same |
| HTTP request counters + latency histograms | ✅ Done | `src/middlewares/observability.js` |
| Auth failure counter | ✅ Done | `src/middlewares/auth.js` |
| Socket event counter | ✅ Done | `src/socket/chatSocket.js` |
| Sentry crash reporting (Android) with PII filter | ✅ Done | `StugramApplication.kt` |
| `/livez` liveness probe | ✅ Done | `src/app.js` |
| `/readyz` readiness probe (Mongo + Redis) | ✅ Done | `src/app.js` |
| External alerting (PagerDuty / Opsgenie) | ❌ Not wired | `docs/alerting.md` defines thresholds; webhook must be configured |

### Backup & Recovery

| Item | Status | Evidence |
|------|--------|---------|
| MongoDB Atlas backup strategy documented | ✅ Done | `docs/backup-restore.md` |
| Cloudinary media backup documented | ✅ Done | `docs/backup-restore.md` |
| Restore drill procedure documented | ✅ Done | `docs/backup-restore.md` |
| Pre-migration protocol documented | ✅ Done | `docs/backup-restore.md` |
| Restore drill actually executed | ❌ Not run | Run monthly against staging; first drill pending |
| `exportCloudinaryToS3.js` script | ❌ Not implemented | Phase 5 item per `docs/backup-restore.md` |

### Runbooks

| Item | Status |
|------|--------|
| Backend down | ✅ `docs/runbooks/backend-down.md` |
| Database down | ✅ `docs/runbooks/db-down.md` |
| Redis down | ✅ `docs/runbooks/redis-down.md` |
| Cloudinary failure | ✅ `docs/runbooks/cloudinary-failure.md` |
| High error rate | ✅ `docs/runbooks/high-error-rate.md` |
| Socket.IO outage | ✅ `docs/runbooks/socket-outage.md` |
| Alerting thresholds | ✅ `docs/alerting.md` |

### Load Testing

| Item | Status | Evidence |
|------|--------|---------|
| k6 auth script | ✅ Done | `scripts/load/k6-auth.js` |
| k6 feed script | ✅ Done | `scripts/load/k6-feed.js` |
| k6 chat script | ✅ Done | `scripts/load/k6-chat.js` |
| Load test plan documented | ✅ Done | `docs/load-test-plan.md` |
| 100 VU test actually run against staging | ❌ Not run | Must be run before launch; results documented in `docs/load-test-plan.md` |

### Chat Reliability

| Item | Status | Notes |
|------|--------|-------|
| Monotonic sequence allocation (backend) | ✅ Implemented | Atomic `$inc` via `chatEventService.allocateSequence` |
| Event replay endpoint (`GET /events?after=N`) | ✅ Implemented | `chatService.getConversationEvents` |
| Reconnect-triggered replay sync (Android) | ✅ Implemented | `ChatDetailScreen.syncMissingEvents` on `ChatSocketEvent.Reconnected` |
| Client-side duplicate handling | ✅ Implemented | `ChatLocalStore` merges by `clientId`/`backendId` |
| Backend `clientId` deduplication | ✅ Implemented | `findExistingClientMessageWithRetry` |
| Tombstone protection (higher-seq wins) | ✅ Implemented | `ChatLocalStore` `serverSequence` guards |
| Tombstone bypass when seq=0 (P2 gap) | ⚠️ P2 gap | Delete socket events missing `serverSequence` can bypass stale-update guard. Workaround: server always emits sequence; safe for current socket schema. |

### Security

| Item | Status |
|------|--------|
| JWT access + refresh token rotation | ✅ |
| bcrypt password hashing | ✅ |
| Rate limiting (express-rate-limit + Redis) | ✅ |
| Socket per-event rate limiting | ✅ |
| Input validation (Zod) on all public routes | ✅ |
| CORS locked to CLIENT_URL | ✅ |
| No secrets committed to repo | ✅ |
| Sentry PII stripping (user, token fields) | ✅ |

---

## Remaining Blockers Before Public Production

### Hard Blockers (must be resolved)

1. **`GOOGLE_WEB_CLIENT_ID`** — Set a real OAuth 2.0 Web Client ID in `strings.xml` or via CI secret to unblock `assembleRelease`.
2. **Load test run** — Execute the 100 VU nominal test against staging and record results in `docs/load-test-plan.md`. If p95 feed latency > 1000 ms, investigate Atlas query plans.
3. **GitHub branch protection** — Enable "Require status checks" on `main` so CI must pass before merge.
4. **Atlas M10+ or Continuous Backup** — Upgrade from free M0 tier before launch for RPO ≤ 1 minute.

### Soft Blockers (P1 — resolve before scale)

5. **External alerting webhook** — Wire `ALERT_WEBHOOK_URL` to PagerDuty/Slack per `docs/alerting.md`.
6. **First restore drill** — Run against staging Atlas cluster, document date + RPO achieved.
7. **Cloudinary export script** (`src/scripts/exportCloudinaryToS3.js`) — Implement before media data at risk.

### Known Limitations (P2 — acceptable for beta)

- `GET /posts/user/:username` has no auth middleware; private account posts always 403 for unauthenticated callers. Documented in `docs/known-limitations.md`.
- Socket delete events with missing `serverSequence` bypass Android tombstone stale-update guard (P2, safe given current server always emits sequence).
- Cloudinary story media not backed up (ephemeral by design — 24h TTL).

---

## Safe User Count for Beta

With current M0 Atlas, Redis free tier, and single Render web service:

| Users | Status |
|-------|--------|
| < 500 registered / < 50 concurrent | ✅ Safe — well within free tier |
| 500–2 000 registered / 50–200 concurrent | ⚠️ Requires load test results; may need Atlas M10 upgrade |
| > 2 000 registered | ❌ Requires Atlas M10+, dedicated Redis, and horizontal scaling plan |

---

## Rollback Readiness

- **Backend**: Render dashboard → Deploys → previous deploy → Redeploy (< 2 min)
- **Android**: Play Store → Releases → previous release → Rollout (requires staged rollout to be configured)
- **Database**: Atlas Backup → Restore to new cluster → swap `MONGODB_URI` (< 4h RTO)
- **Full runbook**: See `docs/runbooks/backend-down.md`
