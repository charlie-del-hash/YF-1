#!/usr/bin/env bash
# The last plaza. 02-DATA-MODEL: "two people tapping 'me apunto' at once must
# not both get the last plaza". A single-session SQL test cannot show this, so
# this fires N real psql connections at the same plan simultaneously and checks
# the arithmetic afterwards. Called by scripts/pgtest.sh, which exports the
# connection env and a `psql` path.
set -uo pipefail

PSQL=("$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -d "$PGDATABASE" -qt -v ON_ERROR_STOP=1)
CAP=3
RACERS=12
fails=0

plan_id="00000000-0000-0000-0000-00000000c0de"
"${PSQL[@]}" >/dev/null <<SQL
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000c' || lpad(i::text, 4, '0'))::uuid,
       'racer' || i || '@test.invalid'
  from generate_series(1, $RACERS) i
on conflict do nothing;

insert into profiles (id, display_name, birth_year, distrito)
select ('00000000-0000-0000-0000-0000000c' || lpad(i::text, 4, '0'))::uuid,
       'Racer ' || i, 1995, 'Centro'
  from generate_series(1, $RACERS) i
on conflict do nothing;

insert into user_sports (user_id, sport, level_norm)
select ('00000000-0000-0000-0000-0000000c' || lpad(i::text, 4, '0'))::uuid, 'running', 5
  from generate_series(1, $RACERS) i
on conflict do nothing;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000c9999', 'racehost@test.invalid')
on conflict do nothing;
insert into profiles (id, display_name, birth_year, distrito)
values ('00000000-0000-0000-0000-0000000c9999', 'Host', 1990, 'Centro')
on conflict do nothing;

insert into venues (id, name, kind, distrito, lat, lng, verified)
values ('00000000-0000-0000-0000-0000000cfffe', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true)
on conflict do nothing;

delete from plans where id = '$plan_id';
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id)
values ('$plan_id', '00000000-0000-0000-0000-0000000c9999', 'running',
        now() + interval '2 days', 'Retiro', 4, 6, '8 km', $CAP,
        '00000000-0000-0000-0000-0000000cfffe');
SQL

out="$(mktemp -d)"
for i in $(seq 1 $RACERS); do
  uid="00000000-0000-0000-0000-0000000c$(printf '%04d' "$i")"
  (
    "${PSQL[@]}" -c "set role authenticated;
                     select set_config('request.jwt.claim.sub', '$uid', true);
                     select join_plan('$plan_id');" 2>/dev/null | tr -d ' ' | grep -E '^(joined|waitlist)$'
  ) > "$out/$i" &
done
wait

joined=$(cat "$out"/* | grep -c '^joined$')
waitlisted=$(cat "$out"/* | grep -c '^waitlist$')
counted=$("${PSQL[@]}" -c "select joined_count from plans where id = '$plan_id';" | tr -d ' ')
rows=$("${PSQL[@]}" -c "select count(*) from plan_participants
                         where plan_id = '$plan_id' and status = 'joined';" | tr -d ' ')
status=$("${PSQL[@]}" -c "select status from plans where id = '$plan_id';" | tr -d ' ')

echo "   $RACERS concurrent joins on a plan with $CAP plazas"
echo "   -> joined=$joined waitlist=$waitlisted joined_count=$counted rows=$rows status=$status"

[ "$joined"     = "$CAP" ]     || { echo "   FAIL: $joined joined, expected $CAP"; fails=1; }
[ "$waitlisted" = "$((RACERS - CAP))" ] || { echo "   FAIL: $waitlisted waitlisted, expected $((RACERS - CAP))"; fails=1; }
[ "$counted"    = "$CAP" ]     || { echo "   FAIL: joined_count=$counted, expected $CAP"; fails=1; }
[ "$rows"       = "$CAP" ]     || { echo "   FAIL: $rows joined rows, expected $CAP"; fails=1; }
[ "$status"     = "full" ]     || { echo "   FAIL: status=$status, expected full"; fails=1; }

rm -rf "$out"
exit "$fails"
