# Phase 4 — DevOps, Observability, Release Pipeline: Completion Report

**Date:** 2026-05-18  
**Branch:** `claude/audit-repo-contents-z1JRE`  
**Readiness:** ~83% (Phase 3 end) → ~90% (Phase 4 end)

---

## Summary

Phase 4 delivered the DevOps, observability, release pipeline, and backup/DR
foundations required before StuGram can graduate from closed beta to public
beta candidate. No product features were changed. Security posture was not
weakened.

---

## Tasks Completed

### Task 1 — GitHub Actions CI/CD

**Files:** `.github/workflows/backend-ci.yml`, `.github/workflows/android-ci.yml`

Backend CI:
- Node.js matrix (20.x, 22.x)
- `npm ci` → `npm run test:ci` → coverage artifact
- Separate lint job (graceful skip if no `.eslintrc`)
- In-memory MongoDB (`mongodb://localhost:27017/stugram_test`) and stub env vars

Android CI:
- JDK 17, Gradle cache via `gradle/actions/setup-gradle@v3`
- `testDebugUnitTest` + `assembleDebug` → APK artifact upload
- Conditional `release-build-check` job: patches `strings.xml` from `GOOGLE_WEB_CLIENT_ID` secret, writes keystore from base64 secret, runs `assembleRelease`

### Task 2 — Release Build Configuration Audit

**Files:** `app/build.gradle.kts`, `gradle.properties`

- Added `resolveSigningProp(envKey, propKey)` helper reading env vars first, then `local.properties`
- Full signing config wired for release builds; falls back to debug signing when config absent
- `SENTRY_DSN` and `CRASH_REPORTING_ENABLED` resolved from env/props at build time
- `gradle.properties`: removed deprecated `android.enableIncrementalDesugaring`; annotated remaining flags with AGP 10 migration notes

**Verification:** `./gradlew assembleDebug` → BUILD SUCCESSFUL. `assembleRelease` intentionally blocked by `checkGoogleClientId` guard (Phase 1 release gate — correct behavior).

### Task 3 — Sentry Production Readiness

**File:** `app/src/main/java/com/example/myapplication/StugramApplication.kt`

- `beforeSend` callback strips `event.user` (PII)
- Regex-based extras filter removes keys matching `token|password|otp|secret|authorization|refresh|access|identity|email|phone`
- `environment` set to `"debug"` / `"production"` based on `BuildConfig.DEBUG`
- `release` set to `"uz.stugram.app@{versionName}+{versionCode}"`
- `isEnableAutoSessionTracking = true`, `isEnableNdk = true`
- Sentry only initializes when `CRASH_REPORTING_ENABLED=true` AND `SENTRY_DSN` is non-blank

### Task 4 — Backend Structured Monitoring / Metrics

**Files:** `src/services/metricsService.js`, `src/middlewares/observability.js`, `src/app.js`, `src/middlewares/auth.js`

`metricsService.js` provides:
- `incrementCounter(name, labels, amount)` / `getCounter(name, labels)`
- `recordLatency(name, valueMs, labels)` with fixed buckets `[10, 50, 100, 250, 500, 1000, 2500, 5000]` ms
- `computePercentiles(histogram, [50, 95, 99])` — approximates from bucket boundaries
- `recordAuthFailure(reason)`, `recordSocketEvent(event)`
- `getFullSnapshot()` → JSON, `renderPrometheusText()` → proper Prometheus text with `_bucket`, `_sum`, `_count` suffixes
- `resetMetrics()` for tests

`observability.js` middleware emits per-request:
- `http_requests_total{method, status}`
- `http_errors_total` (4xx), `http_server_errors_total` (5xx)
- `http_slow_requests_total` (> 2 000 ms)
- `recordLatency("http_request_duration_ms", durationMs, {method})`

`auth.js` calls `recordAuthFailure(reason)` on every 401/403.

`app.js` exposes:
- `GET /metrics` — Prometheus text, protected by `X-Internal-Monitoring-Key`
- `GET /metrics/snapshot` — JSON snapshot, same protection

**Test coverage:** `tests/ops/metricsService.test.js` — 14 tests, all passing.

### Task 5 — Alerting Runbooks

**Files:** `docs/alerting.md`, `docs/runbooks/backend-down.md`, `docs/runbooks/db-down.md`, `docs/runbooks/redis-down.md`, `docs/runbooks/cloudinary-failure.md`, `docs/runbooks/high-error-rate.md`, `docs/runbooks/socket-outage.md`

Each runbook contains: symptoms, detection signal, impact assessment, step-by-step immediate actions, rollback action, escalation timeline, and verification commands.

### Task 6 — MongoDB Backup and Restore Strategy

**File:** `docs/backup-restore.md`

Covers:
- Atlas Continuous Cloud Backup (M10+) and Scheduled Snapshots (M0/M2)
- Retention policy table (daily/weekly/pre-migration/pre-destructive)
- Point-in-time restore procedure
- Monthly restore drill script
- Pre-migration protocol with `--dryRun` step
- Cloudinary media backup (Add-on or manual S3 export)
- Orphan cleanup reference
- RTO/RPO targets: RPO ≤ 24h, RTO ≤ 4h for beta

### Task 7 — Load Testing Setup

**Files:** `scripts/load/k6-auth.js`, `scripts/load/k6-feed.js`, `scripts/load/k6-chat.js`, `docs/load-test-plan.md`

k6 scripts cover: login/refresh, feed pagination (cursor-based), profile, post detail, conversation list, message history, message send, event replay sync.

Three load levels: 50 VU smoke, 100 VU nominal, 200 VU stress.

Note: Socket.IO real-time path excluded from k6 (protocol not supported). HTTP chat REST path fully covered.

### Task 8 — Chat Reliability Audit

**Verdict:**

| Concern | Status | Notes |
|---------|--------|-------|
| Monotonic sequence allocation | ✅ Implemented | `chatEventService.allocateSequence` → atomic `$inc` |
| Gap detection via event replay | ✅ Implemented | `GET /events?after=N` endpoint |
| Reconnect-triggered sync | ✅ Implemented | `ChatDetailScreen` calls `syncMissingEvents` on `ChatSocketEvent.Reconnected` |
| Duplicate suppression (backend) | ✅ Implemented | `clientId` dedup with retry |
| Duplicate suppression (Android) | ✅ Implemented | `ChatLocalStore` merges by `clientId` + `backendId` |
| Tombstone protection | ✅ Implemented | Higher `serverSequence` wins; deletes not overwritten by stale updates |
| seq=0 tombstone bypass | ⚠️ P2 | If server emits delete event with `serverSequence=0` (not currently possible), Android stale-update guard is skipped. Mitigation: server always emits sequence via `recordChatEvent`. No test added (behavior matches current server contract). |

No tests added — existing chat service tests and migration tests cover the implemented behavior. The P2 gap is documented.

### Task 9 — Production Gate Documentation

**Files:** `docs/PRODUCTION_CANDIDATE_GATE.md`, `docs/release-build.md`, this file.

---

## Test Results

### Backend

```
npm test — 133 tests, 133 passing (0 failing)
```

Breakdown:
- Existing suites (Phase 1–3): 119 tests
- `tests/ops/metricsService.test.js`: 14 new tests
- All passing

### Android

```
./gradlew assembleDebug — BUILD SUCCESSFUL
./gradlew assembleRelease — BLOCKED (intentional: checkGoogleClientId)
```

---

## Files Changed / Created in Phase 4

```
.github/workflows/backend-ci.yml           (new)
.github/workflows/android-ci.yml           (new)
gradle.properties                          (updated)
app/build.gradle.kts                       (updated: signing, DSN, resolveSigningProp)
app/src/main/java/.../StugramApplication.kt (updated: beforeSend, env/release metadata)
src/services/metricsService.js             (new)
src/middlewares/observability.js           (updated: emits to metricsService)
src/app.js                                 (updated: /metrics, /metrics/snapshot endpoints)
src/middlewares/auth.js                    (updated: recordAuthFailure)
tests/ops/metricsService.test.js           (new, 14 tests)
docs/alerting.md                           (new)
docs/runbooks/backend-down.md              (new)
docs/runbooks/db-down.md                   (new)
docs/runbooks/redis-down.md                (new)
docs/runbooks/cloudinary-failure.md        (new)
docs/runbooks/high-error-rate.md           (new)
docs/runbooks/socket-outage.md             (new)
docs/backup-restore.md                     (new)
scripts/load/k6-auth.js                    (new)
scripts/load/k6-feed.js                    (new)
scripts/load/k6-chat.js                    (new)
docs/load-test-plan.md                     (new)
docs/release-build.md                      (new)
docs/PRODUCTION_CANDIDATE_GATE.md          (new)
docs/phase4-devops-observability-report.md (this file)
```

---

## Remaining Before Public Production Launch

See `docs/PRODUCTION_CANDIDATE_GATE.md` for the full gate checklist. Hard blockers:

1. Set real `GOOGLE_WEB_CLIENT_ID` to unblock `assembleRelease`
2. Run 100 VU load test against staging; record results
3. Enable GitHub branch protection on `main`
4. Upgrade Atlas to M10+ for RPO ≤ 1 min continuous backup
