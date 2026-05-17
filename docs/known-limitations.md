# Known Limitations (Public Beta)

This document tracks intentional limitations and deferred work as of the public-beta milestone. These are not bugs — they are scoped decisions.

## Android

| Area | Limitation | Ticket / Notes |
|------|-----------|----------------|
| Certificate pinning | Deferred. Render.com auto-rotates Let's Encrypt certs without advance notice; static pins would cause hard failures after rotation. Switch to Render's static IP / custom domain + managed cert before enabling. | Phase 4 |
| Google Sign-In | Disabled in closed-beta builds (placeholder Client ID). See `docs/google-auth-setup.md`. | Phase 3 |
| Instrumented tests | Room migration tests require a connected device/emulator. Run via `./gradlew connectedDebugAndroidTest`. Not run in pull-request CI. | Phase 4 |
| Crash reporting DSN | Disabled by default. Must be configured via `SENTRY_DSN` buildConfigField before production release. See `docs/crash-reporting.md`. | Phase 3 |
| Notification permission | `POST_NOTIFICATIONS` is declared; runtime request helper (`NotificationPermissionHelper`) is available but not yet wired to an explicit UI prompt. Wire it to a meaningful first-use moment (e.g. after first login) in the main screen. | Phase 4 |

## Backend

| Area | Limitation | Notes |
|------|-----------|-------|
| Feed pagination | Page-based with optional `before` cursor. True keyset pagination (pure cursor) is deferred to avoid a schema change on the posts collection. | Phase 4 |
| Email delivery | Uses `passwordResetDeliveryService`. No email bounce handling or retry queue. | Phase 4 |
| Rate limits | Configurable via `RATE_LIMIT_MAX` / `AUTHENTICATED_RATE_LIMIT_MAX`. Default values are intentionally conservative for closed beta. | — |
| Push notifications | FCM/APNs token registration is wired. No topic subscriptions or silent push for socket reconnect yet. | Phase 4 |

## Infrastructure

| Area | Limitation | Notes |
|------|-----------|-------|
| Redis | Single node. No cluster or Sentinel setup. Connection loss triggers bounded exponential reconnect (10 retries, 30 s cap). | Phase 4 |
| Atlas | Single M0/M2 cluster. No read replicas. Atlas performance advisor alerts should be reviewed before public beta. | Phase 4 |
