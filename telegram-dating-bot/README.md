# ForOne — Telegram dating bot

Standalone Telegram bot for a dating/matchmaking service. See `.env.example`
for every environment variable the app reads, and `render.yaml` for how a
fresh deploy is provisioned end to end.

## Backups

The database (`foreveryone-db` on Render) holds every profile, like, match,
referral and payment record the bot has. Render's free Postgres is also
**time-limited** — it is deleted after 30 days unless upgraded — so a backup
is not optional.

A GitHub Actions workflow (`.github/workflows/backup.yml`) runs
`scripts/backup.sh` once a day: it dumps the database, encrypts the dump, and
sends it to you as a Telegram document. If any step fails, you get a Telegram
alert instead of a silent gap in your backups.

Render Cron Jobs require a paid plan, which is why this runs on GitHub
Actions instead.

### GitHub Secrets required

Set these under the repository's **Settings → Secrets and variables →
Actions**:

| Secret | Where to get it |
|---|---|
| `DATABASE_URL_EXTERNAL` | Render dashboard → `foreveryone-db` → **Connect** → **External** tab. This is *not* the same value as the bot service's `DATABASE_URL` — that one is Render's internal hostname and does not resolve outside Render's own network. |
| `TELEGRAM_BOT_TOKEN` | The bot that will deliver the backup file — normally the admin bot's token. Whoever `ALERT_CHAT_ID` belongs to must have sent `/start` to this bot at least once, or Telegram refuses to let it message them. |
| `ALERT_CHAT_ID` | Your own numeric Telegram user id (get it from `@userinfobot`). Same value the app itself uses for `ALERT_CHAT_ID` — see `.env.example`. |
| `BACKUP_KEY` | A strong passphrase you generate yourself, e.g. `openssl rand -base64 32`. **Store this somewhere that survives independently of this repository and of Render** — a password manager, not a note next to the backups. |

> ⚠️ **`BACKUP_KEY` cannot be recovered.** Every backup is encrypted with
> AES-256 using this passphrase. If it is lost, every backup ever taken —
> past and future, until you set a new key and start over — is permanently
> unreadable. There is no reset, no recovery email, nothing to appeal to.
> Treat losing this key as equivalent to having no backups at all.

### GitHub's own limit on scheduled workflows

GitHub disables a scheduled (`cron`) workflow after **60 days with no other
activity in the repository** (no commits, no PRs, nothing). If the project
goes quiet for two months, the backups stop — silently, because the workflow
that would normally alert you is the one that stopped firing. Check the
**Actions** tab occasionally, or re-enable it there if it shows as disabled.
`workflow_dispatch` is also enabled on this workflow, so you can always
trigger a backup by hand from the Actions tab regardless of the schedule.

### Restoring from a backup

1. Open the Telegram chat where the backup arrived and download the
   `foreveryone-backup-YYYY-MM-DD.sql.gpg` file.
2. Decrypt it with the same `BACKUP_KEY` it was encrypted with:
   ```
   gpg --decrypt --batch --yes --passphrase "$BACKUP_KEY" \
     -o foreveryone-backup-YYYY-MM-DD.sql \
     foreveryone-backup-YYYY-MM-DD.sql.gpg
   ```
3. Restore into a Postgres database (an empty one — this is a plain SQL dump,
   not a diff):
   ```
   psql "$DATABASE_URL_EXTERNAL" -f foreveryone-backup-YYYY-MM-DD.sql
   ```
4. Point the bot's `DATABASE_URL` at that database and restart it.
5. **Delete the decrypted `.sql` file when you are done.** Unlike the `.gpg`
   file, it is plain text containing real phone numbers and payment records.

## Alerts

Set `ALERT_CHAT_ID` (see `.env.example`) to receive a Telegram message when:

- Either bot throws an error handling an update
- The process hits an uncaught exception and is about to restart
- A daily backup fails (or, each day it succeeds, a short confirmation)

`/health` reports `"alerts": "configured"` once this is set, the same way it
already reports admin-PIN and Click-payment configuration.
