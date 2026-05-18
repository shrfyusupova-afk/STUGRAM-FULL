# Backup and Restore Strategy

## Overview

StuGram's persistent data lives in two external services:
1. **MongoDB Atlas** — all user data, posts, conversations, messages
2. **Cloudinary** — all media (photos, videos, avatars, story assets)

Redis is ephemeral (rate-limit counters, BullMQ job queue). It is not backed up; data is safely reconstructible on restart.

---

## MongoDB Atlas Backup

### Strategy: Atlas Continuous Cloud Backup

Enable **Continuous Cloud Backup** on the Atlas cluster:
- Atlas dashboard → Cluster → Backup → Enable Continuous Cloud Backup
- Cost: included on M10+; not available on free M0/M2 tiers

For M0/M2 (closed beta):
- Enable **Scheduled Snapshots** (free, daily):
  - Atlas → Cluster → Backup → Schedule a snapshot
  - Frequency: **daily at 03:00 UTC**
  - Retain: **7 days of daily snapshots**, **4 weeks of weekly snapshots**

### Retention Policy

| Snapshot Type | Frequency | Retention |
|--------------|-----------|-----------|
| Daily (beta) | Every 24h | 7 days |
| Weekly (beta) | Every Sunday | 4 weeks |
| Pre-migration | Manual, before any schema change | 30 days |
| Pre-destructive-op | Manual, before bulk delete/update | 30 days |

### What is NOT backed up by Atlas snapshots
- In-flight write operations at the exact moment of snapshot (acceptable, RPO ≤ 1 min with continuous backup)
- Redis data (intentional — ephemeral)
- Local developer DBs

---

## Restore Procedure

### Atlas Point-in-Time Restore

1. Atlas dashboard → Cluster → Backup → Snapshots
2. Select the snapshot or point-in-time target
3. Click **Restore** → choose:
   - **Restore to same cluster** (overwrites current data — take manual snapshot first)
   - **Restore to new cluster** (safe — verify, then swap MONGODB_URI)
4. Notify team: maintenance window starts
5. Update `MONGODB_URI` in Render env vars to point at restored cluster
6. Redeploy the backend
7. Verify via `/readyz` → `mongoConnected: true`
8. Run smoke tests (login, post, chat send)
9. Communicate restore completion to users

### Restore Drill (monthly)

Run monthly in staging:
```bash
# 1. Trigger Atlas restore to a temporary cluster (atlas-restore-test)
# 2. Point staging backend at atlas-restore-test
# 3. Run the integration test suite against staging
npm test
# 4. Verify row counts match production (spot check)
mongo $STAGING_MONGODB_URI --eval "db.users.countDocuments()"
# 5. Tear down the temporary cluster
```

Document drill results in a Notion/Confluence table: date, snapshot used, result, RPO achieved.

---

## Pre-Migration Protocol

Before any destructive MongoDB migration (adding/dropping indexes, schema changes, bulk updates):

```bash
# Step 1: Take a named manual snapshot in Atlas
# Atlas → Cluster → Backup → Take Snapshot Now
# Name: "pre-migration-YYYY-MM-DD-<ticket-id>"

# Step 2: Note the exact MongoDB version and document count
mongo $MONGODB_URI --eval "
  print('Users:', db.users.countDocuments());
  print('Posts:', db.posts.countDocuments());
  print('Messages:', db.messages.countDocuments());
"

# Step 3: Run migration with --dryRun if supported

# Step 4: Verify counts after migration
# Step 5: Keep the pre-migration snapshot for 30 days minimum
```

---

## Cloudinary Media Backup

### Strategy

Cloudinary does **not** provide automatic backups on free/paid plans by default. Options:

1. **Cloudinary Backup Add-on** (paid) — backed up to S3 or GCS. Recommended for production.
2. **Manual export script** — periodically sync Cloudinary assets to your own S3 bucket.

Recommended for public beta:
```bash
# Export all media assets to S3 (run weekly via cron or Render cron job)
# Requires: cloudinary, aws-sdk, CLOUDINARY_* and AWS_* env vars
node src/scripts/exportCloudinaryToS3.js --since 7d
```

### Orphan Cleanup

When users delete posts/stories, the Cloudinary asset is deleted immediately by the backend. However, failed deletes can leave orphans. Run monthly:

```bash
# 1. Enumerate Cloudinary public IDs in use (from MongoDB)
# 2. Enumerate all Cloudinary assets in your cloud
# 3. Delete assets not referenced in MongoDB
# See: src/scripts/cleanupOrphanedMedia.js (to be implemented in Phase 5)
```

### Retention Policy

| Media Type | TTL in Cloudinary | Notes |
|-----------|-------------------|-------|
| Post images/videos | Permanent (until user deletes) | Backed up |
| Story media | 24h (auto-expire via Cloudinary) | Not backed up (ephemeral by design) |
| Avatars/banners | Permanent | Backed up |
| Thumbnail transforms | Auto-generated on demand | Not backed up (re-generated) |

---

## RTO / RPO Targets (Beta)

| Metric | Target | How Achieved |
|--------|--------|--------------|
| RPO (Recovery Point Objective) | ≤ 24h | Daily Atlas snapshots |
| RTO (Recovery Time Objective) | ≤ 4h | Atlas restore + env update + redeploy |
| Media RPO | ≤ 7 days | Weekly Cloudinary → S3 sync |

Upgrade to continuous backup (M10+ Atlas tier) for RPO ≤ 1 minute before public launch.

---

## Emergency Contacts

| System | Contact |
|--------|---------|
| MongoDB Atlas | https://support.mongodb.com |
| Cloudinary | https://support.cloudinary.com |
| Render | https://feedback.render.com / Render dashboard support |
