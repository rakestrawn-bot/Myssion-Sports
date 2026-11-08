#!/usr/bin/env bash
# Runs the database tests against a throwaway local Postgres.
#
#   npm run test:db
#
# It creates a temporary database server, loads a stand-in for Supabase's
# login system, applies every migration in supabase/migrations in order,
# runs every test in supabase/tests, then deletes the temporary server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "Postgres server binaries not found. Install PostgreSQL or set PG_BIN." >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${TEST_DB_PORT:-54329}"

# Postgres refuses to run as root, so use the postgres account when needed.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}
[[ "$(id -u)" == "0" ]] && chown postgres "$WORK"

cleanup() {
  as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

as_pg "$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/log" -w \
  -o "-p $PORT -k $WORK -c listen_addresses=''" start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres)
"${PSQL[@]}" -d postgres -c "create database test" >/dev/null

# Shows only the test results ("ok - ...") and any errors.
run() {
  echo "-- $(basename "$1")"
  "${PSQL[@]}" -d test -f "$1" 2>&1 >/dev/null | sed -E 's/^psql:[^ ]+ (NOTICE|WARNING):  //'
  return "${PIPESTATUS[0]}"
}

run "$ROOT/supabase/tests/00_auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do run "$f"; done
for f in "$ROOT"/supabase/tests/*_test.sql; do run "$f"; done
