# Runbook: Cloudinary Failure

## Symptoms
- Photo/video uploads fail with 500 or hang indefinitely
- Existing images may return 404 (if Cloudinary CDN is degraded)
- `POST /api/v1/posts` or story creation returns `upload_failed` error
- `/health` → `cloudinaryConfigured: false`

## Detection Signal
- Upload error rate on `/api/v1/posts` exceeds 5%
- `/health` → `cloudinaryConfigured: false`
- Cloudinary status page (https://status.cloudinary.com) shows incident
- Logs contain: `Error: Upload timed out`, `Cloudinary API error`, `ETIMEDOUT`

## Impact Assessment

| Scope | User Visible Impact |
|-------|---------------------|
| Upload API down | Cannot create new posts or stories |
| CDN degraded | Existing images/videos load slowly or fail |
| Quota exceeded | Uploads fail; existing content still serves |

Note: **Read operations** (viewing feed, profiles) are unaffected if only the upload API is down.

## Immediate Actions

### 1. Check Cloudinary status (< 2 min)
```
https://status.cloudinary.com
```

### 2. Verify credentials (< 1 min)
```bash
# In Render env vars, verify:
# CLOUDINARY_CLOUD_NAME
# CLOUDINARY_API_KEY
# CLOUDINARY_API_SECRET
# All three must be present and match the Cloudinary dashboard.
```

### 3. Check quota (< 1 min)
- Cloudinary dashboard → Usage → check storage and bandwidth.
- Free tier: 25 credits/month. Overage blocks uploads.

### 4. Check environment config
```bash
curl -H "X-Internal-Monitoring-Key: $INTERNAL_METRICS_KEY" \
  https://stugram-beckend.onrender.com/health | jq '.data.cloudinaryConfigured'
# Must return true
```

## Rollback Action

**If Cloudinary is having an incident:**
- Post a status update for users: "Media uploads temporarily unavailable."
- Wait for Cloudinary to resolve. Most incidents resolve within 1 hour.
- No code change required; the app will resume uploads automatically.

**If credentials are wrong:**
- Update `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Render env vars.
- Redeploy the backend.

**If quota exceeded:**
- Upgrade Cloudinary plan, or
- Run orphan cleanup to free storage:
  ```bash
  # List and delete Cloudinary assets not referenced in MongoDB
  # (implement via src/scripts/cleanupOrphanedMedia.js — see backup-restore.md)
  ```

## Escalation
- **15 min**: If Cloudinary incident is ongoing, notify users via in-app banner.
- **60 min**: If Cloudinary incident continues, evaluate temporary fallback storage (S3, Supabase Storage).

## Verification After Fix
```bash
# Upload a test image via the API
curl -X POST https://stugram-beckend.onrender.com/api/v1/posts \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -F "caption=cloudinary_health_check" \
  -F "media=@/tmp/test.jpg"
# Must return 201 with a Cloudinary URL in the response.
```
