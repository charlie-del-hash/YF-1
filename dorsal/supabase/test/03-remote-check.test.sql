-- Post-deploy check. Run this against a real Supabase project after applying
-- the migrations and the seed — paste it into the SQL editor whole.
--
-- It proves the things that are worth proving on the real thing rather than on
-- a local copy: that RLS is actually enabled, that every table carries a
-- policy, that the seed landed and sits in the future, and that the safety
-- invariants hold when the query runs as `anon` and as `authenticated` rather
-- than as the owner. Everything it writes is rolled back.
--
-- It is also run by scripts/pgtest.sh, so the script itself is known to work
-- before anyone pastes it anywhere. Two consequences of being written for the
-- SQL editor as well as for psql: no psql meta-commands (the runner sets
-- ON_ERROR_STOP on the command line), and results are collected into a table
-- and selected at the end rather than raised as notices, which the editor does
-- not display. A check whose output you cannot see is not a check.

begin;

create or replace function test_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end;
$$;

-- Everything the later blocks need, resolved now, while this still runs as the
-- table owner. Looking these up after `set role` returns nothing — RLS is doing
-- its job — and the assertions would then pass vacuously against nulls.
-- Two real plans for the join assertions. They cannot be seed plans: 0013
-- makes join_plan() refuse those outright, which is the point of that
-- migration. Created here, as the table owner, inside the transaction this
-- file ends by rolling back — so nothing is left on the project it is pasted
-- into, and the seed itself is never modified.
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id, audience)
select x.id, p.id, 'running', now() + interval '5 days', v.distrito,
       x.lo, x.hi, x.label, 6, v.id, 'todos'
  from (values
          -- Hosted by Javi, so Marta (running 5) may join it.
          ('00000000-0000-0000-0000-00000000c001'::uuid, 2, 4, 6, '8 km'),
          -- Hosted by Marta, and too fast for Javi (running 4).
          ('00000000-0000-0000-0000-00000000c002'::uuid, 1, 5, 6, '8 km rápido')
       ) as x(id, host_dorsal, lo, hi, label)
  join profiles p on p.dorsal_number = x.host_dorsal
  cross join lateral (select id, distrito from venues order by name limit 1) v;

create temporary table _fixtures on commit drop as
select
  (select id from profiles where dorsal_number = 1) as mujer_id,     -- Marta, running 5
  (select id from profiles where dorsal_number = 2) as hombre_id,    -- Javi, running 4
  -- A plan the joiner does not host: join_plan() rejects the host of a plan
  -- before it ever looks at levels or capacity.
  '00000000-0000-0000-0000-00000000c001'::uuid as joinable_plan_id,
  '00000000-0000-0000-0000-00000000c002'::uuid as too_fast_plan_id,
  -- And one seed plan, to prove the refusal is live on this deployment.
  (select id from plans where is_seed order by starts_at limit 1) as seed_plan_id;
grant select on _fixtures to authenticated, anon;

-- Steps 4 onwards run as anon/authenticated, so they need INSERT here as well
-- as SELECT on _fixtures. Without it every one of them fails with "permission
-- denied for table _results" — which looks like a policy problem and is not.
create temporary table _results (step text, outcome text) on commit drop;
grant select, insert on _results to authenticated, anon;

do $$
declare f _fixtures%rowtype;
begin
  select * into f from _fixtures;
  assert f.mujer_id is not null and f.hombre_id is not null,
    'the seed profiles are missing — apply supabase/seed.sql first';
  assert f.joinable_plan_id is not null, 'no seeded running plan a level-5 runner could join';
end $$;

-- ── 1. RLS is on, and every table has a policy ──────────────────────────────
-- CVE-2025-48757 exists because RLS is off by default on new tables and nobody
-- checks. This is the check.
do $$
declare
  unprotected text;
  policyless  text;
begin
  select string_agg(c.relname, ', ') into unprotected
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert unprotected is null, 'tables without RLS: ' || unprotected;

  select string_agg(c.relname, ', ') into policyless
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
  assert policyless is null, 'tables with RLS but no policy: ' || policyless;

  insert into _results values ('1. RLS on every table, a policy on every table', 'ok');
end $$;

-- ── 2. the seed landed, and it is in the future ─────────────────────────────
do $$
declare v_venues int; v_profiles int; v_plans int; v_past int; v_min timestamptz;
begin
  select count(*) into v_venues   from venues   where is_seed;
  select count(*) into v_profiles from profiles where is_seed;
  select count(*) into v_plans    from plans    where is_seed;
  assert v_venues   = 19, 'seeded venues: '   || v_venues;
  assert v_profiles = 10, 'seeded profiles: ' || v_profiles;
  assert v_plans    = 15, 'seeded plans: '    || v_plans;

  select count(*), min(starts_at) into v_past, v_min from plans where is_seed and starts_at <= now();
  assert v_past = 0, v_past || ' seeded plans are already in the past (earliest ' || v_min || ')';
  insert into _results values ('2. seed loaded and entirely upcoming',
    v_venues || ' venues, ' || v_profiles || ' profiles, ' || v_plans || ' plans');
end $$;

-- ── 3. seeded venues are labelled unverified ────────────────────────────────
-- Their coordinates were written from general knowledge. Until someone
-- confirms them against a real source they must not read as confirmed.
do $$
declare n int;
begin
  select count(*) into n from venues where is_seed and verified;
  assert n = 0, n || ' seeded venues are marked verified without being confirmed';
  insert into _results values ('3. every seeded venue still flagged unverified', 'ok');
end $$;

-- ── 4. anon sees nothing ────────────────────────────────────────────────────
set local role anon;
do $$ begin
  assert (select count(*) from plans)           = 0, 'anon can read plans';
  assert (select count(*) from profiles)        = 0, 'anon can read profiles';
  assert (select count(*) from venues)          = 0, 'anon can read venues';
  assert (select count(*) from public_profiles) = 0, 'anon can read public_profiles';
  insert into _results values ('4. anon sees nothing', 'ok');
end $$;

set local role authenticated;
do $$ begin
  perform test_as(null);
  assert (select count(*) from plans)    = 0, 'authenticated-with-no-subject can read plans';
  assert (select count(*) from profiles) = 0, 'authenticated-with-no-subject can read profiles';
  insert into _results values ('5. a session with no JWT subject sees nothing', 'ok');
end $$;

-- ── 5. solo mujeres, against the real seed ──────────────────────────────────
-- Javi (dorsal 2) declared hombre; Marta (dorsal 1) declared mujer. The seed
-- contains exactly one solo_mujeres plan.
do $$
declare f _fixtures%rowtype; n int;
begin
  select * into f from _fixtures;

  perform test_as(f.hombre_id);
  select count(*) into n from plans where audience = 'solo_mujeres';
  assert n = 0, 'a man can see a solo_mujeres plan';
  select count(*) into n from plan_participants
   where plan_id in (select id from plans where audience = 'solo_mujeres');
  assert n = 0, 'a man can read the roster of a solo_mujeres plan';

  perform test_as(f.mujer_id);
  select count(*) into n from plans where audience = 'solo_mujeres';
  assert n = 1, 'a woman cannot see the solo_mujeres plan (saw ' || n || ')';
  insert into _results values ('6. solo mujeres invisible through every query path', 'ok');
end $$;

-- ── 6. public_profiles leaks nothing ────────────────────────────────────────
do $$
declare cols text[];
begin
  select array_agg(column_name::text order by column_name) into cols
    from information_schema.columns where table_name = 'public_profiles';
  assert not ('gender' = any(cols)),       'public_profiles leaks gender';
  assert not ('birth_year' = any(cols)),   'public_profiles leaks birth_year';
  assert not ('is_suspended' = any(cols)), 'public_profiles leaks moderation state';
  insert into _results values ('7. public_profiles exposes only roster fields', 'ok');
end $$;

-- ── 7. joining works, and its gates hold ────────────────────────────────────
-- Rolled back with everything else, so this leaves no participant behind.
do $$
declare f _fixtures%rowtype; r join_status; n int;
begin
  select * into f from _fixtures;

  perform test_as(f.mujer_id);
  r := join_plan(f.joinable_plan_id);
  assert r = 'joined', 'join_plan returned ' || r;
  select joined_count into n from plans where id = f.joinable_plan_id;
  assert n = 1, 'joined_count did not move: ' || n;

  -- The gate most likely to be wrong on a real deployment: the level band.
  perform test_as(f.hombre_id);
  if f.too_fast_plan_id is not null then
    begin
      r := join_plan(f.too_fast_plan_id);
      assert false, 'a level-4 runner joined a faster plan';
    exception when others then
      assert sqlerrm = 'level_mismatch', 'wrong error: ' || sqlerrm;
    end;
  end if;
  insert into _results values ('8. join_plan joins, and refuses an out-of-band level', 'ok');
end $$;

-- ── 9. example plans refuse to be joined ────────────────────────────────────
do $$
declare f _fixtures%rowtype; r join_status;
begin
  select * into f from _fixtures;
  if f.seed_plan_id is not null then
    perform test_as(f.hombre_id);
    begin
      r := join_plan(f.seed_plan_id);
      assert false, 'an example plan was joinable on this deployment';
    exception when others then
      assert sqlerrm = 'seed_plan', 'wrong error: ' || sqlerrm;
    end;
  end if;
  insert into _results values ('9. example plans cannot be joined', 'ok');
end $$;

-- Nine rows means nine checks passed. Fewer means the run stopped early, and
-- the error above says where.
reset role;
select step, outcome from _results order by step;

rollback;
