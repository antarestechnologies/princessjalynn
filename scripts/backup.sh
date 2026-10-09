#!/usr/bin/env bash
# Logical backup of the Postgres database (Neon or any Postgres 16).
#
#   DATABASE_URL=postgres://... scripts/backup.sh [output-dir]
#
# Writes a pg_dump custom-format file plus its sha256. The dump contains the 2257 vault
# ciphertext; it is useless without VAULT_ENCRYPTION_KEY, which is stored separately (never
# in the same place as the dump). Neon's point-in-time restore is the primary safety net;
# this is the offline copy the custodian keeps. See docs/runbooks/backup-restore.md.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${1:-backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/db-$STAMP.dump"
pg_dump --format=custom --no-owner --no-privileges --compress=9 --file="$FILE" "$DATABASE_URL"
sha256sum "$FILE" > "$FILE.sha256"
echo "wrote $FILE ($(du -h "$FILE" | cut -f1))"
