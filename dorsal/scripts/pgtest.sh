#!/usr/bin/env bash
# Boots a throwaway Postgres, applies the shim + every migration + the seed,
# then runs each supabase/test/*.test.sql. Exits non-zero on the first failure.
#
#   ./scripts/pgtest.sh
#
# Nothing here touches a real Supabase project.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${PGTEST_DIR:-$(mktemp -d)}"
export PGDATA="$WORK/data" PGHOST="$WORK/sock" PGPORT=54329 PGDATABASE=dorsal_test
mkdir -p "$PGHOST"

# Postgres refuses to run as root. In a container that is often the only user,
# so re-exec the whole script as the unprivileged `postgres` account.
if [ "$(id -u)" -eq 0 ]; then
  RUNAS="${PGTEST_USER:-postgres}"
  chmod 777 "$WORK"; chown -R "$RUNAS" "$WORK"
  exec su -s /bin/bash "$RUNAS" -c "PGTEST_DIR='$WORK' PGBIN='$PGBIN' bash '${BASH_SOURCE[0]}'"
fi
export PGUSER="$(id -un)"

cleanup() { "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$PGDATA" -U "$PGUSER" --no-sync >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-k $PGHOST -p $PGPORT -c listen_addresses=" -w start >/dev/null
"$PGBIN/createdb" -h "$PGHOST" -p "$PGPORT" "$PGDATABASE"

run() { "$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q "$@"; }

run -f "$ROOT/supabase/test/00-supabase-shim.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "-- migration $(basename "$m")"
  run -f "$m"
done
if [ -f "$ROOT/supabase/seed.sql" ]; then echo "-- seed"; run -f "$ROOT/supabase/seed.sql"; fi

status=0
shopt -s nullglob
for t in "$ROOT"/supabase/test/*.test.sql; do
  echo "-- test $(basename "$t")"
  if ! run -f "$t"; then status=1; echo "FAILED: $(basename "$t")"; fi
done

if [ -x "$ROOT/supabase/test/concurrency.sh" ]; then
  echo "-- test concurrency.sh"
  export PGBIN PGHOST PGPORT PGDATABASE
  if ! bash "$ROOT/supabase/test/concurrency.sh"; then status=1; echo "FAILED: concurrency.sh"; fi
fi

if [ "$status" -eq 0 ]; then echo "all sql tests passed"; fi
exit "$status"
