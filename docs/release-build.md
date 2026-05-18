# Release Build Guide

## Backend — Render Deployment

### Required Environment Variables

All must be set in Render → Service → Environment before deploying.

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | HTTP port (Render sets automatically) | `3000` |
| `MONGODB_URI` | Atlas connection string (SRV format) | `mongodb+srv://user:pass@cluster.mongodb.net/stugram?retryWrites=true&w=majority` |
| `JWT_ACCESS_SECRET` | ≥ 32-char random secret | — |
| `JWT_REFRESH_SECRET` | ≥ 32-char random secret, different from access | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `30d` |
| `REDIS_URL` | Redis connection string | `rediss://default:pass@host:6379` |
| `REDIS_TLS_ENABLED` | Set to `true` for TLS (Render Redis, Upstash) | `true` |
| `REDIS_REQUIRED` | `false` allows degraded mode without Redis | `false` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | — |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — |
| `CLIENT_URL` | Allowed CORS origin (Android app origin or `*` for beta) | `https://your-frontend.com` |
| `INTERNAL_METRICS_KEY` | Secret header for `/metrics` and `/health` | ≥ 20 random chars |
| `OTP_SECRET` | HMAC key for OTP generation | ≥ 32-char random |
| `EMAIL_HOST` | SMTP host for OTP emails | `smtp.mailgun.org` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | SMTP username | — |
| `EMAIL_PASS` | SMTP password | — |
| `EMAIL_FROM` | From address | `noreply@stugram.uz` |
| `SENTRY_DSN` | Sentry backend DSN (optional) | `https://...@sentry.io/...` |
| `RATE_LIMIT_MAX` | Max requests / window per IP | `100` |
| `AUTHENTICATED_RATE_LIMIT_MAX` | Authenticated request limit | `300` |

### Feature Flags (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAT_REALTIME_ENABLED` | `true` | Toggle Socket.IO real-time |
| `FEATURE_SOCKET_JOIN_CONVERSATION` | `true` | Toggle socket room join |
| `RECOMMENDATION_REFRESH_ENABLED` | `true` | Toggle BullMQ recommendation job |

### Deploy Procedure

1. Push to `main` (Render auto-deploys from main)
2. Monitor Render deploy log for startup errors
3. After deploy, verify:
   ```bash
   curl -f https://stugram-beckend.onrender.com/livez       # must return 200
   curl -f https://stugram-beckend.onrender.com/readyz      # must return mongoConnected, redisConnected
   ```
4. Check `/health` with the internal key for full service status

---

## Android — Release APK / AAB

### Required Signing Configuration

Set these as GitHub Actions secrets **or** in `local.properties` (never commit):

| Secret / Property | Description |
|-------------------|-------------|
| `KEYSTORE_PATH` / `signing.keystore.path` | Path to `.jks` or `.keystore` file |
| `KEYSTORE_PASSWORD` / `signing.keystore.password` | Store password |
| `KEY_ALIAS` / `signing.key.alias` | Key alias inside the keystore |
| `KEY_PASSWORD` / `signing.key.password` | Key password |
| `GOOGLE_WEB_CLIENT_ID` | OAuth 2.0 Web Client ID from Google Cloud Console |

For CI (GitHub Actions), also set:
- `KEYSTORE_BASE64` — base64-encoded `.jks` file
- `GOOGLE_WEB_CLIENT_ID` — patches `app/src/main/res/values/strings.xml` before build

### Creating a Release Keystore (first time)

```bash
keytool -genkeypair -v \
  -keystore stugram-release.jks \
  -alias stugram-key \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storepass <store-password> \
  -keypass <key-password> \
  -dname "CN=StuGram, OU=Mobile, O=StuGram LLC, L=Tashkent, ST=Tashkent, C=UZ"

# Encode for GitHub Actions secret
base64 -w 0 stugram-release.jks > stugram-release.jks.b64
```

Store the `.jks` file in a password manager. **Do not commit it.**

### local.properties (developer machine)

```properties
# Add to local.properties (git-ignored)
signing.keystore.path=/absolute/path/to/stugram-release.jks
signing.keystore.password=<store-password>
signing.key.alias=stugram-key
signing.key.password=<key-password>
```

### Build Commands

```bash
# Debug APK (no signing config required)
./gradlew assembleDebug

# Release APK (requires signing config + real google_web_client_id)
./gradlew assembleRelease

# Release AAB (for Play Store)
./gradlew bundleRelease
```

### BuildConfig Fields

| Field | Source | Default |
|-------|--------|---------|
| `SENTRY_DSN` | `local.properties` → `sentry.dsn` or env `SENTRY_DSN` | `""` (Sentry disabled) |
| `CRASH_REPORTING_ENABLED` | `gradle.properties` `crashReportingEnabled` | `false` |
| `SOCKET_URL` | `local.properties` `socket.url` or env `SOCKET_URL` | `http://10.0.2.2:3000` |

### Release Blockers (Intentional Guards)

The build intentionally fails with:
```
RELEASE BLOCKED: google_web_client_id is still the placeholder value.
```
if `strings.xml` still contains `YOUR_GOOGLE_WEB_CLIENT_ID`. This is enforced by
the `checkGoogleClientId` Gradle task and cannot be bypassed without setting a
real OAuth 2.0 Web Client ID.

### Version Bump Procedure

Before each release:
1. Increment `versionCode` in `app/build.gradle.kts`
2. Update `versionName` (semver: `1.0.0`, `1.0.1`, etc.)
3. Tag the commit: `git tag v1.0.0 && git push --tags`

### App Signing on Play Store

After uploading the first AAB, enable **Play App Signing** in the Play Console.
Google then manages the final signing key; your upload key is only used to verify
the AAB before upload.

---

## Health Check Sequence (After Any Release)

```bash
# 1. Backend liveness
curl -f https://stugram-beckend.onrender.com/livez

# 2. Backend readiness (DB + Redis)
curl -f https://stugram-beckend.onrender.com/readyz

# 3. Full health (internal)
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/health | jq '.data'

# 4. Smoke tests
npm test --prefix /path/to/backend   # or run CI

# 5. Android: install APK on device and run login → post → chat flow manually
```
