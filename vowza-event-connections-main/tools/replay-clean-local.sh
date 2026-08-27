#!/usr/bin/env bash
set -euo pipefail

PGHOST="${PGHOST:-}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
DB_NAME="${DB_NAME:-vowza_clean_replay}"

case "$PGHOST" in
  ""|127.0.0.1|localhost|::1) ;;
  *) echo "Refusing clean replay on non-local PGHOST=$PGHOST" >&2; exit 2 ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGHOST PGPORT PGUSER

psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\";"

psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tools/local_managed_schema_bootstrap.sql"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tools/local_storage_bootstrap.sql"

while IFS= read -r migration; do
  migration_name="$(basename "$migration")"
  # The public-only rebaseline supersedes the historical emergency ACL file.
  # Skip it only when all four legacy function signatures are absent; never
  # silently skip any other migration.
  if [[ "$migration_name" == 20261126000000_emergency_revoke_escalation.sql ]] &&
     [[ "$(psql -d "$DB_NAME" -Atqc "select count(*) from (values (to_regprocedure('public.make_admin(uuid)')), (to_regprocedure('public.make_provider(uuid)')), (to_regprocedure('public.approve_artist(uuid,uuid)')), (to_regprocedure('public.reject_artist(uuid,uuid,text)'))) as f(signature) where signature is not null")" == "0" ]]; then
    echo "Skipping $migration_name: superseded by the public-only baseline (target functions absent)"
    continue
  fi
  echo "Applying $migration_name"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done < <(find "$ROOT_DIR/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print | sort)

if [[ -f "$ROOT_DIR/tools/local_seed.sql" ]]; then
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tools/local_seed.sql"
fi

while IFS= read -r assertion; do
  echo "Running $(basename "$assertion")"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$assertion" >/dev/null
done < <(find "$ROOT_DIR/supabase/tests" -maxdepth 1 -type f -name '*.sql' -print 2>/dev/null | sort)

echo "Clean local replay passed: $DB_NAME on $PGHOST:$PGPORT"
