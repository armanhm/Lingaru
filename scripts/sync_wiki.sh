#!/usr/bin/env bash
# Mirror docs/wiki/*.md to the GitHub Wiki (docs/ stays the source of truth).
#
# Usage: scripts/sync_wiki.sh [--dry-run]
#
# - Wiki page links like `[X](Some-Page.md)` become `[X](Some-Page)`.
# - Links out of the wiki (`../specs/x.md`, `../../backend/...`) become absolute
#   GitHub blob URLs on the default branch, so they work from the Wiki too.
# - Each page gets a header pointing back at its source file.
#
# Prerequisite (one time): the Wiki repo only exists after the first page is
# created in the GitHub UI (Wiki tab -> "Create the first page" -> Save).
set -euo pipefail

REPO="${WIKI_REPO:-armanhm/Lingaru}"
BRANCH="${WIKI_SOURCE_BRANCH:-main}"
ROOT="$(git rev-parse --show-toplevel)"
SRC="$ROOT/docs/wiki"
BLOB="https://github.com/$REPO/blob/$BRANCH"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet --depth 1 "https://github.com/$REPO.wiki.git" "$WORK/wiki"

# Remove pages that no longer exist in docs/wiki (keep the wiki's .git).
find "$WORK/wiki" -maxdepth 1 -name '*.md' -delete

for page in "$SRC"/*.md; do
  name="$(basename "$page")"
  {
    printf '> Mirrored from [`docs/wiki/%s`](%s/docs/wiki/%s). Edit it there; this page is overwritten on sync.\n\n' \
      "$name" "$BLOB" "$name"
    sed -E \
      -e "s#\]\(\.\./\.\./([^)]+)\)#](${BLOB}/\1)#g" \
      -e "s#\]\(\.\./([^)]+)\)#](${BLOB}/docs/\1)#g" \
      -e 's#\]\(([A-Za-z0-9_-]+)\.md(\#[^)]*)?\)#](\1\2)#g' \
      "$page"
  } > "$WORK/wiki/$name"
done

# GitHub Wiki sidebar from Home.md's page list, if present.
[[ -f "$SRC/_Sidebar.md" ]] && sed -E 's#\]\(([A-Za-z0-9_-]+)\.md\)#](\1)#g' "$SRC/_Sidebar.md" > "$WORK/wiki/_Sidebar.md"

cd "$WORK/wiki"
git add -A
if git diff --cached --quiet; then
  echo "Wiki already up to date."
  exit 0
fi
git diff --cached --stat
if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry run: not pushing)"
  exit 0
fi
git commit --quiet -m "Sync from docs/wiki @ $(git -C "$ROOT" rev-parse --short HEAD)"
git push --quiet
echo "Wiki synced."
