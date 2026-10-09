#!/usr/bin/env bash
# Proves a backup restores: loads a dump into a throwaway database, then verifies schema,
# row counts and that vault records still decrypt with VAULT_ENCRYPTION_KEY.
#
#   RESTORE_ADMIN_URL=postgres://user@host:5432/postgres \
#   VAULT_ENCRYPTION_KEY=... SESSION_SECRET=... \
#   scripts/restore-check.sh backups/db-YYYYMMDDTHHMMSSZ.dump
#
# RESTORE_ADMIN_URL must point at a server where the user may CREATE DATABASE. Never point it
# at production.
set -euo pipefail
DUMP="${1:?usage: restore-check.sh <dump-file>}"
: "${RESTORE_ADMIN_URL:?RESTORE_ADMIN_URL is required}"
if [ -f "$DUMP.sha256" ]; then sha256sum -c "$DUMP.sha256"; fi
DB="restore_check_$(date -u +%s)"
BASE="${RESTORE_ADMIN_URL%/*}"
psql "$RESTORE_ADMIN_URL" -qc "create database $DB"
trap 'psql "$RESTORE_ADMIN_URL" -qc "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$BASE/$DB" "$DUMP"
DATABASE_URL="$BASE/$DB" npx tsx scripts/restore-verify.ts
