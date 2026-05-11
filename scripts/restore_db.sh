#!/usr/bin/env bash
#
# Restore a Lingaru postgres dump produced by backup_db.sh.
#
# Usage:  ./scripts/restore_db.sh /home/lingaru/backups/lingaru-20260511-030000.sql.gz
#
# This DROPS and RECREATES the lingaru database, so all current data is
# lost. Intentional, so the dump (which contains DROP TABLE statements)
# applies cleanly.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path-to-gzipped-dump>" >&2
  exit 2
fi

DUMP="$1"
if [ ! -f "$DUMP" ]; then
  echo "Not a file: $DUMP" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "About to restore $DUMP into the running lingaru postgres container."
echo "This will OVERWRITE all current data. Press Ctrl-C to abort, Enter to continue."
read -r

gunzip -c "$DUMP" | docker compose exec -T postgres \
  psql --username=lingaru --dbname=lingaru

echo "Restore complete."
