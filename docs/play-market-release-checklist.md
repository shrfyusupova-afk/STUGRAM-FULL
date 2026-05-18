# Play Store Release Checklist

**App:** StuGram — Student Social Network  
**Package:** `uz.stugram.app`  
**Target:** Google Play Store (Android)

Status legend: ✅ DONE | ⚠️ PARTIAL | ❌ BLOCKED/TODO

---

## 1. Technical Prerequisites

| Item | Status | Notes |
|------|--------|-------|
| `applicationId = "uz.stugram.app"` | ✅ DONE | Set in `app/build.gradle.kts` |
| `minSdk = 26` (Android 8.0) | ✅ DONE | Covers ~97% of active devices |
| `targetSdk = 34` | ✅ DONE | Required for Play submissions in 2024+ |
| `versionCode` incremented for each release | ⚠️ TODO | Currently `1`; increment before each upload |
| `versionName` follows semver (e.g. `1.0.0`) | ⚠️ TODO | Currently `"1.0"` |
| Release AAB build (`bundleRelease`) | ❌ BLOCKED | Requires `GOOGLE_WEB_CLIENT_ID` (Phase 5 blocker) |
| R8 minification + resource shrinking enabled | ✅ DONE | `isMinifyEnabled = true`, `isShrinkResources = true` |
| ProGuard rules configured | ✅ DONE | `proguard-rules.pro` exists |

---

## 2. App Signing

| Item | Status | Notes |
|------|--------|-------|
| Keystore generated | ❌ TODO | See `docs/release-build.md` for `keytool` command |
| Keystore stored securely (password manager) | ❌ TODO | Must NOT be committed to git |
| `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` configured | ❌ TODO | Set as GitHub Actions secrets or `local.properties` |
| Play App Signing enrolled | ❌ TODO | Enable in Play Console → Setup → App Signing on first AAB upload |
| Upload key (different from distribution key) documented | ❌ TODO | Play Console manages distribution key after enrollment |

---

## 3. Google Play Console Setup

| Item | Status | Notes |
|------|--------|-------|
| Google Play Developer account ($25 one-time fee) | ❌ TODO | https://play.google.com/console |
| App created in Play Console | ❌ TODO | Create → `uz.stugram.app` |
| Default language set | ❌ TODO | e.g. `en-US` |
| App category set | ❌ TODO | Social → Social Networking |
| Free / Paid set | ❌ TODO | Free (with in-app purchases if applicable) |

---

## 4. Store Listing

### Required Text

| Item | Status | Requirement |
|------|--------|-------------|
| Short description | ❌ TODO | Max 80 characters |
| Full description | ❌ TODO | Max 4000 characters |
| App title | ❌ TODO | "StuGram" (max 30 chars) |
| Developer name | ❌ TODO | Must match registered developer account |

### Suggested Text (draft)

**Short description:**
> StuGram — the social app built for students. Share moments, connect with classmates, chat in real time.

**Full description (draft):**
> StuGram is a student-focused social platform for sharing posts, stories, and connecting with your university community.
>
> Features:
> - Instagram-style feed with photos and videos
> - Real-time direct and group messaging
> - Stories that disappear after 24 hours
> - Follow/unfollow, private accounts, and block controls
> - Voice and video calls
> - Smart recommendations based on shared interests
>
> Built for students. Designed for real connections.

---

## 5. Graphic Assets

| Item | Status | Requirement |
|------|--------|-------------|
| App icon (512×512 PNG) | ❌ TODO | No alpha; no rounded corners (Play adds them) |
| Feature graphic (1024×500 PNG or JPEG) | ❌ TODO | Shown at top of store listing |
| Screenshots — phone | ❌ TODO | Min 2, max 8; min 320px on shortest side |
| Screenshots — tablet 7" | ❌ TODO | Optional but recommended |
| Screenshots — tablet 10" | ❌ TODO | Optional but recommended |
| Promo video (YouTube URL) | ❌ TODO | Optional |

---

## 6. Legal & Policy

| Item | Status | Notes |
|------|--------|-------|
| Privacy Policy URL | ❌ TODO | Required. Must be publicly accessible. Cover: data collected, third-party services (MongoDB Atlas, Cloudinary, Google OAuth, Sentry), deletion rights |
| Terms of Service URL | ❌ TODO | Required for apps with user accounts |
| Account deletion workflow | ❌ TODO | Required as of Nov 2023. Must be in-app AND linked in store listing. See: https://support.google.com/googleplay/android-developer/answer/13327111 |
| Support email address | ❌ TODO | Required. Publicly visible on store listing |
| Website URL | ❌ TODO | Optional but recommended |

---

## 7. Data Safety Form

Google requires declaring all data collected and shared. Fill in the Play Console → Policy → Data Safety form.

| Data type | Collected? | Shared? | Encrypted? | Deletable? |
|-----------|-----------|---------|------------|------------|
| Name (full name) | ✅ Yes | No | Yes (in transit) | Yes (account deletion) |
| Email address | ✅ Yes | No | Yes | Yes |
| Username | ✅ Yes | Yes (visible to others) | Yes | Yes |
| Photos/videos | ✅ Yes (user-uploaded) | Yes (public posts) | Yes (in transit) | Yes |
| Messages | ✅ Yes | Yes (between participants) | Yes | Yes |
| Crash logs | ✅ Yes (via Sentry) | Yes (Sentry — third party) | Yes | No (aggregated) |
| Device/app identifiers | ✅ Yes (Sentry) | Yes (Sentry) | Yes | No |
| Location | ❌ No | — | — | — |
| Contacts | ❌ No | — | — | — |
| Financial info | ❌ No | — | — | — |

**Third-party libraries to declare:**
- Sentry (crash reporting) — collects device info, crash data
- Google OAuth (sign-in) — Google account identity

---

## 8. Content Rating

Complete the IARC questionnaire in Play Console → Policy → App Content → Content rating.

Expected rating: **Everyone** (or **Teen** if user-generated content moderation is not in place)

| Category | Answer |
|----------|--------|
| Violence | None |
| Sexual content | None |
| Language | None |
| Controlled substance | None |
| User-generated content | Yes — social posts, messages |
| Location sharing | No |

> User-generated content (UGC) section requires confirming moderation policy and abuse reporting mechanism.

---

## 9. Permissions Justification

Document why each permission is needed (required for Play review):

| Permission | Declared in Manifest? | Justification |
|------------|----------------------|---------------|
| `INTERNET` | ✅ Yes | Required to communicate with backend API |
| `POST_NOTIFICATIONS` | ✅ Yes | Push notifications for messages and activities (Android 13+) |
| `CAMERA` | ❌ TODO | Needed for in-app photo/video capture for posts |
| `READ_MEDIA_IMAGES` | ❌ TODO | Needed for photo selection from gallery |
| `READ_MEDIA_VIDEO` | ❌ TODO | Needed for video selection from gallery |
| `RECORD_AUDIO` | ❌ TODO | Needed for voice messages and audio calls |

> Review `AndroidManifest.xml` to confirm all declared permissions have a clear purpose justification for the Play reviewer.

---

## 10. Target API Level

| Requirement | Status |
|-------------|--------|
| targetSdk ≥ 34 (required for new apps from Aug 2024) | ✅ DONE |
| App tested on Android 8.0+ (minSdk 26) | ⚠️ TODO — requires device/emulator testing |
| 64-bit support | ✅ DONE — Kotlin compiles to 64-bit |

---

## 11. Staged Rollout Plan

| Stage | % of users | Duration | Action if metrics degrade |
|-------|-----------|----------|--------------------------|
| Internal test | 10–20 testers | 1 week | Fix, re-upload |
| Closed alpha | 50–100 users | 1 week | Fix critical crashes |
| Open beta | 5% of eligible | 1 week | Monitor crash rate, ANR rate |
| Production rollout | 10% | 3 days | Monitor; halt if crash rate > 1% |
| Production rollout | 50% | 3 days | Monitor |
| Full production | 100% | — | Monitor |

Play Console dashboard monitors: crash rate, ANR rate, ratings, reviews.

**Halt criteria:** If crash rate > 1% or ANR rate > 0.5% at any stage, halt rollout and fix.

---

## 12. Rollback Plan

| Scenario | Action |
|----------|--------|
| Critical crash (> 5% crash rate) | Halt rollout in Play Console immediately |
| Data loss bug discovered | Roll back via Play Console → Release management → previous release |
| Backend breaking change | Redeploy previous backend version on Render (< 2 min) |
| Security vulnerability | Emergency patch: bypass staged rollout, deploy directly to 100% |

> Note: Play Store rollbacks take 1–4 hours to propagate fully.

---

## 13. Pre-Launch Checklist (Final Gate)

Run through before clicking "Release to Production":

- [ ] `assembleRelease` / `bundleRelease` succeeds with real signing config
- [ ] App tested on physical device (not emulator only)
- [ ] Login, post creation, chat, and story creation work on release build
- [ ] Sentry crash reporting verified (intentional test crash shows in Sentry dashboard)
- [ ] Google Sign-In works with real production `GOOGLE_WEB_CLIENT_ID`
- [ ] Deep links and notification taps route correctly
- [ ] Account deletion flow is reachable in-app
- [ ] Privacy policy URL is live and accessible
- [ ] Backend `/readyz` returns healthy on production cluster
- [ ] 100 VU load test passed on staging
- [ ] No placeholder strings (`YOUR_GOOGLE_WEB_CLIENT_ID`, `TODO`, `PLACEHOLDER`) in release build

---

## Summary: Items Required Before Play Submission

| Priority | Item |
|----------|------|
| P0 | Set real `GOOGLE_WEB_CLIENT_ID` → unblocks `bundleRelease` |
| P0 | Generate and configure release keystore |
| P0 | Privacy policy and Terms of Service live URLs |
| P0 | Account deletion in-app flow |
| P0 | Support email |
| P1 | Store listing text and screenshots |
| P1 | App icon (512×512) and feature graphic |
| P1 | Data safety form completed |
| P1 | Content rating questionnaire completed |
| P2 | CAMERA, READ_MEDIA_*, RECORD_AUDIO permissions added to manifest |
| P2 | Promo video (optional) |
