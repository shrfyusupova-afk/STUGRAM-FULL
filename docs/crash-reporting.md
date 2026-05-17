# Crash Reporting

StuGram uses [Sentry](https://sentry.io) for crash reporting via the `sentry-android` SDK. Reporting is **opt-in at build time** — it is disabled unless both `CRASH_REPORTING_ENABLED=true` and a valid `SENTRY_DSN` are configured.

## Setup

### 1. Create a Sentry project

Log in to [sentry.io](https://sentry.io), create an **Android** project, and copy the DSN from **Settings → Projects → {your project} → Client Keys (DSN)**.

### 2. Configure BuildConfig fields

In `app/build.gradle.kts`, update the `defaultConfig` (or a `release {}` build-type override):

```kotlin
buildConfigField("String",  "SENTRY_DSN",              "\"https://YOUR_KEY@o0.ingest.sentry.io/PROJECT_ID\"")
buildConfigField("Boolean", "CRASH_REPORTING_ENABLED", "true")
```

**Never commit a real DSN to version control.** Use `local.properties` or a CI secret instead:

```kotlin
// app/build.gradle.kts
val sentryDsn = project.findProperty("SENTRY_DSN")?.toString() ?: ""
buildConfigField("String", "SENTRY_DSN", "\"$sentryDsn\"")
```

Then set `SENTRY_DSN=https://...` in `local.properties` (already `.gitignore`d) or as a CI environment variable.

### 3. Verify

Build and run the app. Navigate to **Sentry → Issues** — a session-start event should appear within a minute. To test a real crash, temporarily add `throw RuntimeException("test")` to `StugramApplication.onCreate()`, observe it in Sentry, then revert.

## Architecture

`StugramApplication` (registered in `AndroidManifest.xml` as `android:name=".StugramApplication"`) calls `SentryAndroid.init()` in `onCreate()`. Initialization is gated by `BuildConfig.CRASH_REPORTING_ENABLED`, so debug builds default to no-op reporting unless explicitly configured.

## Privacy considerations

- Sentry is configured with **auto session tracking** only. No PII (user IDs, email, message content) is sent by default.
- Do not add `Sentry.setUser()` calls without a documented privacy review.
- EU deployments should use `sentry.io` EU endpoint or a self-hosted Sentry instance to comply with GDPR data residency requirements.
