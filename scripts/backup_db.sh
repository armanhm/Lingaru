#!/usr/bin/env bash
#
# Postgres backup for Lingaru on Hetzner.
#
# Usage:  scripts/backup_db.sh [label]
#
#   (no label)  nightly backup: lingaru-<ts>.sql.gz, pruned after
#               RETENTION_DAYS (default 14).
#   <label>     labelled backup, e.g. "predeploy": lingaru-<label>-<ts>.sql.gz,
#               the newest KEEP_LAST (default 10) per label are kept.
#
# The dump is written to a .partial file, verified with gzip -t, and only
# then renamed, so a failed run never leaves a plausible-looking bad dump
# and never prunes anything. The last line printed is BACKUP_FILE=<path>
# so callers (the deploy workflow) can pick the file up.
#
# Nightly setup (one-time, on the server, as the lingaru user):
#
#   mkdir -p ~/backups
#   crontab -e
#   0 3 * * *  /home/lingaru/Lingaru/scripts/backup_db.sh >> ~/backups/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
KEEP_LAST="${KEEP_LAST:-10}"
LABEL="${1:-}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
if [ -n "$LABEL" ]; then
  OUT="$BACKUP_DIR/lingaru-${LABEL}-${TIMESTAMP}.sql.gz"
else
  OUT="$BACKUP_DIR/lingaru-${TIMESTAMP}.sql.gz"
fi
PARTIAL="$OUT.partial"
trap 'rm -f "$PARTIAL"' EXIT

cd "$PROJECT_ROOT"

log "starting backup -> $OUT"

# pg_dump runs inside the container, which already has POSTGRES_USER and
# POSTGRES_DB from compose. --no-owner / --clean / --if-exists keep the
# dump portable to a fresh DB on restore.
docker compose exec -T postgres \
  sh -c 'pg_dump --no-owner --clean --if-exists --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$PARTIAL"

gzip -t "$PARTIAL"
if [ ! -s "$PARTIAL" ]; then
  log "ERROR: dump is empty" >&2
  exit 1
fi
mv "$PARTIAL" "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
log "wrote $OUT ($SIZE)"

if [ -n "$LABEL" ]; then
  # Keep only the newest KEEP_LAST files for this label (timestamps sort).
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "lingaru-${LABEL}-*.sql.gz" \
    | sort -r | tail -n "+$((KEEP_LAST + 1))" \
    | while read -r old; do rm -f "$old" && log "pruned $old (keeping last $KEEP_LAST)"; done
else
  # Nightly files start with a digit after "lingaru-"; labelled ones do not.
  PRUNED=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'lingaru-[0-9]*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
  if [ "$PRUNED" -gt 0 ]; then
    log "pruned $PRUNED old backup(s) (>${RETENTION_DAYS}d)"
  fi
fi

log "done"
echo "BACKUP_FILE=$OUT"
