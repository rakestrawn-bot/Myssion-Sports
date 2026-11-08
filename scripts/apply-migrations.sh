#!/usr/bin/env bash
# Applies any migrations in supabase/migrations that the live Supabase
# project hasn't had yet, oldest first, through Supabase's management API.
#
#   SUPABASE_PROJECT_REF=vrjwfhufiwodnhjzoono SUPABASE_ACCESS_TOKEN=... npm run db:migrate
#
# In Claude Code cloud sessions the token is added by the network proxy, so
# SUPABASE_ACCESS_TOKEN can be left unset there.
#
# Each migration runs in one transaction together with the record of it in
# supabase_migrations.schema_migrations (the same table the Supabase CLI
# uses), so a migration is either fully applied and recorded, or not at all.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${SUPABASE_PROJECT_REF:-vrjwfhufiwodnhjzoono}"
API="https://api.supabase.com/v1/projects/$REF/database/query"

AUTH=()
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
fi

# Runs SQL from stdin; prints the JSON result, fails on an API error.
query() {
  local body out code
  body="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))')"
  out="$(curl -sS --max-time 120 -w '\n%{http_code}' -X POST "$API" \
           -H 'Content-Type: application/json' "${AUTH[@]}" -d "$body")"
  code="${out##*$'\n'}"
  out="${out%$'\n'*}"
  if [[ "$code" != 2* ]]; then
    echo "Supabase returned HTTP $code: $out" >&2
    return 1
  fi
  printf '%s' "$out"
}

query >/dev/null <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
SQL

applied="$(echo 'select coalesce(json_agg(version), $$[]$$::json) as v from supabase_migrations.schema_migrations;' \
  | query | python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin)[0]["v"]))')"

count=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  if grep -qx "$version" <<<"$applied"; then
    echo "already applied: $base"
    continue
  fi
  echo "applying:        $base"
  {
    echo "begin;"
    cat "$f"
    echo
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"
    echo "commit;"
  } | query >/dev/null
  count=$((count + 1))
done

echo "Done. $count new migration(s) applied."
