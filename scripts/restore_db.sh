#!/usr/bin/env bash
#
# Restore a Lingaru postgres dump produced by backup_db.sh.
#
# Usage:  scripts/restore_db.sh [--yes] /home/lingaru/backups/lingaru-20260511-030000.sql.gz
#
# This REPLACES the contents of the public schema, so current data is
# overwritten. To avoid silent data loss the script first takes a
# "prerestore" backup of the current database (skip only with
# SKIP_SAFETY_BACKUP=1), and applies the dump in a single transaction so a
# bad dump leaves the database untouched. --yes skips the interactive
# prompt (used by the deploy workflow). Stop the app containers first so
# nothing writes during the restore.

set -euo pipefail

ASSUME_YES=0
if [ "${1:-}" = "--yes" ]; then
  ASSUME_YES=1
  shift
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 [--yes] <path-to-gzipped-dump>" >&2
  exit 2
fi

DUMP="$1"
if [ ! -f "$DUMP" ]; then
  echo "Not a file: $DUMP" >&2
  exit 2
fi
gzip -t "$DUMP"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "About to restore $DUMP into the running lingaru postgres container."
if [ "$ASSUME_YES" -ne 1 ]; then
  echo "This will OVERWRITE all current data. Press Ctrl-C to abort, Enter to continue."
  read -r
fi

if [ "${SKIP_SAFETY_BACKUP:-0}" != "1" ]; then
  echo "Saving the current database first (prerestore backup)..."
  "$SCRIPT_DIR/backup_db.sh" prerestore
fi

# -1 runs the schema reset and the dump in one transaction. Dropping the
# schema (not just relying on the dump's DROP ... IF EXISTS) also removes
# tables created by migrations newer than the dump.
gunzip -c "$DUMP" | docker compose exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -f -'

echo "Restore complete."
