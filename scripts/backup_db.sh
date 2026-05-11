#!/usr/bin/env bash
#
# Nightly Postgres backup for Lingaru on Hetzner.
#
# Dumps the lingaru database to a timestamped gzipped file, keeps the
# last 14 days, prunes older ones. Designed to be run from cron as the
# `lingaru` user.
#
# Setup (one-time, on the server, as the lingaru user):
#
#   mkdir -p ~/backups
#   crontab -e
#   # add:
#   0 3 * * *  /home/lingaru/Lingaru/scripts/backup_db.sh >> ~/backups/backup.log 2>&1
#
# That runs the backup nightly at 03:00 server time. Adjust the path if
# the project lives elsewhere. The script is idempotent and noisy on
# failure, look at backup.log if a backup goes missing.

set -euo pipefail

# Resolve project root from script location so we can run docker compose.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/lingaru-${TIMESTAMP}.sql.gz"

cd "$PROJECT_ROOT"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] starting backup -> $OUT"

# Stream pg_dump out of the running postgres container, gzip on the fly.
# Using --no-owner / --clean / --if-exists makes the dump portable to a
# fresh DB on restore.
docker compose exec -T postgres \
  pg_dump --no-owner --clean --if-exists --username=lingaru lingaru \
  | gzip > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] wrote $OUT ($SIZE)"

# Prune anything older than $RETENTION_DAYS days.
PRUNED=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'lingaru-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
if [ "$PRUNED" -gt 0 ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pruned $PRUNED old backup(s) (>${RETENTION_DAYS}d)"
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] done"
