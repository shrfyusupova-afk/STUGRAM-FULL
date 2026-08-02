#!/usr/bin/env bash
# Dumps the production database, encrypts it, and hands it to the operator
# over Telegram -- the only copy of every profile, like, referral and payment
# record that exists outside Render's own (30-day, free-tier) database.
#
# Every step below fails LOUDLY on purpose. A backup script that silently
# skips a broken step is worse than no backup script: it produces a green
# checkmark and a file nobody can restore from, and that is only discovered
# the day it is actually needed.
#
# Required environment:
#   DATABASE_URL_EXTERNAL  Postgres connection string reachable from OUTSIDE
#                          Render (Render's own DATABASE_URL is internal-only
#                          and does not resolve from a GitHub Actions runner).
#   TELEGRAM_BOT_TOKEN     A bot token that has been /start'd by whoever
#                          ALERT_CHAT_ID belongs to (the admin bot's token,
#                          if there is one).
#   ALERT_CHAT_ID          Where the encrypted dump, and any failure alert,
#                          is delivered.
#   BACKUP_KEY             The passphrase the dump is encrypted with.
#                          THERE IS NO RECOVERY WITHOUT IT -- losing this
#                          passphrase makes every backup ever taken
#                          permanently unreadable. Keep it somewhere that
#                          survives independently of this repository and of
#                          Render (a password manager, not a text file next
#                          to the backups themselves).
set -euo pipefail

# Telegram's Bot API caps sendDocument at 50MB; stay comfortably under it
# rather than discover the exact limit during an actual incident.
MAX_SIZE_BYTES=$((45 * 1024 * 1024))

DUMP_FILE="$(mktemp /tmp/foreveryone-backup-XXXXXX.sql)"
ENC_FILE="${DUMP_FILE}.gpg"

cleanup() {
  # Plaintext dump and its encrypted copy both contain real user data
  # (phone numbers, payment records) -- neither may outlive this run, success
  # or failure.
  rm -f "$DUMP_FILE" "$ENC_FILE"
}
trap cleanup EXIT

send_telegram_message() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${ALERT_CHAT_ID}" \
    --data-urlencode "text=$1" \
    >/dev/null || true
}

fail() {
  echo "BACKUP FAILED: $1" >&2
  send_telegram_message "🚨 Kunlik backup MUVAFFAQIYATSIZ: $1"
  exit 1
}

for var in DATABASE_URL_EXTERNAL TELEGRAM_BOT_TOKEN ALERT_CHAT_ID BACKUP_KEY; do
  if [ -z "${!var:-}" ]; then
    fail "${var} environment variable is not set"
  fi
done

# The whole point of installing from the PGDG apt repo (see the workflow)
# is a pg_dump that is never older than the server -- but PATH can still
# resolve to a DIFFERENT, older pg_dump that was already on the runner
# before that install ran, silently defeating it. So don't trust PATH: look
# directly at every versioned client under /usr/lib/postgresql/*/bin and use
# the newest one, exactly the same way postgresql-common's own version
# selection is supposed to work, just without depending on it.
PG_DUMP_BIN="pg_dump"
newest_versioned="$(ls -d /usr/lib/postgresql/*/bin/pg_dump 2>/dev/null | sort -V | tail -1)"
if [ -n "$newest_versioned" ]; then
  PG_DUMP_BIN="$newest_versioned"
fi
echo "Using pg_dump: $($PG_DUMP_BIN --version)"

echo "Dumping database..."
# --no-owner --no-privileges: a restore target will not have the exact same
# role names Render created, and GRANT/OWNER statements for roles that do not
# exist there would abort the restore partway through.
if ! "$PG_DUMP_BIN" "$DATABASE_URL_EXTERNAL" --no-owner --no-privileges -f "$DUMP_FILE"; then
  fail "pg_dump exited with a non-zero status -- see the workflow log for pg_dump's own error output"
fi

DUMP_SIZE=$(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE")
if [ "$DUMP_SIZE" -eq 0 ]; then
  fail "pg_dump produced an empty file -- a broken pipe or a silently truncated connection looks exactly like this"
fi
echo "Dump size: ${DUMP_SIZE} bytes"

echo "Encrypting..."
if ! gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase "$BACKUP_KEY" -o "$ENC_FILE" "$DUMP_FILE"; then
  fail "gpg encryption failed"
fi

ENC_SIZE=$(stat -c%s "$ENC_FILE" 2>/dev/null || stat -f%z "$ENC_FILE")
if [ "$ENC_SIZE" -eq 0 ]; then
  fail "the encrypted file is empty -- gpg reported success but produced nothing"
fi
if [ "$ENC_SIZE" -gt "$MAX_SIZE_BYTES" ]; then
  fail "encrypted backup is ${ENC_SIZE} bytes, over the $((MAX_SIZE_BYTES / 1024 / 1024))MB limit -- it was NOT sent, the database has outgrown this script"
fi

echo "Uploading to Telegram..."
DATE_STAMP=$(date -u +%Y-%m-%d)
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
  -F chat_id="${ALERT_CHAT_ID}" \
  -F document=@"${ENC_FILE};filename=foreveryone-backup-${DATE_STAMP}.sql.gpg" \
  -F caption="Kunlik backup — ${DATE_STAMP}")

# Click's webhook code in this same repo does this exact check for the exact
# same reason: an HTTP 200 from Telegram is not itself proof of success, only
# the "ok":true field in the body is.
if ! echo "$RESPONSE" | grep -q '"ok":true'; then
  fail "Telegram sendDocument did not confirm success: ${RESPONSE}"
fi

echo "Backup sent successfully."
send_telegram_message "✅ Kunlik backup muvaffaqiyatli yuborildi (${DATE_STAMP}, $((ENC_SIZE / 1024)) KB)."
