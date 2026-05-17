# Public Beta Gate Checklist

This document defines the exit criteria for the closed-beta phase and the entry criteria for public beta. All items must be verified before the public-beta tag is cut.

## Security (must pass)

- [x] TLS 1.2+ enforced via `ConnectionSpec.MODERN_TLS` in release builds
- [x] Auth tokens excluded from Android Backup and cloud sync (`backup_rules.xml`, `data_extraction_rules.xml`)
- [x] JWT legacy token migration is race-condition-safe (E11000 + atomic `User.updateOne`)
- [x] Rate limiter respects `AUTHENTICATED_RATE_LIMIT_MAX` and `RATE_LIMIT_MAX` without silent overrides
- [x] Health endpoint public response contains no Redis host, port, or Atlas connection details
- [x] Redis reconnect uses bounded exponential backoff (max 10 retries, 30 s cap)
- [x] Chat DB wiped on logout via `ChatDatabase.clearAndWipe()`
- [x] `POST_NOTIFICATIONS` declared; runtime permission helper available for Android 13+
- [ ] Certificate pinning — **DEFERRED** (Render auto-rotates certs; see `known-limitations.md`)
- [ ] Google OAuth Client ID replaced with production value (see `docs/google-auth-setup.md`)
- [ ] Sentry DSN configured with production credentials (see `docs/crash-reporting.md`)

## Functionality (must pass)

- [x] Email/password login and registration end-to-end
- [x] Password reset flow (forgot-password OTP + reset-password)
- [x] Chat real-time via Socket.IO with gap detection on reconnect
- [x] Chat cursor advances monotonically; old events are skipped on reconnect
- [x] Feed respects block relationships (blocker ↔ blocked bidirectional exclusion)
- [x] Private accounts return 403 to non-followers
- [x] Feed `before` cursor prevents duplicate posts across page boundaries
- [ ] Google Sign-In end-to-end (blocked on Client ID — see above)
- [ ] Push notifications delivered to real FCM tokens (requires production `google-services.json`)

## Testing (must pass)

- [x] All backend Jest tests pass: `npm test` → ≥112 tests, 0 failures
- [x] Android unit tests pass: `./gradlew testDebugUnitTest`
- [x] Android debug build succeeds: `./gradlew assembleDebug`
- [x] Release build blocked by Gradle guard until placeholder Client ID is replaced
- [ ] Instrumented Room migration tests on a physical/emulator device: `./gradlew connectedDebugAndroidTest`
- [ ] Manual smoke test on Android 13+ device (notification permission dialog)
- [ ] Manual smoke test on Android 12 device (no permission dialog shown)

## Infrastructure (must pass before launch)

- [ ] `SENTRY_DSN` set in production CI secrets
- [ ] `INTERNAL_METRICS_KEY` set in production environment (prevents metric endpoint exposure)
- [ ] MongoDB Atlas alerts configured (disk, connections, slow queries)
- [ ] Redis eviction policy set to `noeviction` or `allkeys-lru` depending on use case
- [ ] `LAUNCH_GATE_ENABLED=false` environment variable confirmed for public launch

## Play Store requirements

- [x] `applicationId = "uz.stugram.app"` (non-`com.example` namespace)
- [ ] `versionCode` bumped to ≥ 2 before first Play Store upload
- [ ] App signing key generated and stored in secure key store
- [ ] Play Store listing: screenshots, description, privacy policy URL
- [ ] Privacy policy covers: account data, camera/microphone usage, notification data

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering lead | — | — |
| QA lead | — | — |
| Product owner | — | — |
