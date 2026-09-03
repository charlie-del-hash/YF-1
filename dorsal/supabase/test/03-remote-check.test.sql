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
-- before anyone pastes it anywhere.
\set ON_ERROR_STOP on

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
create temporary table _fixtures on commit drop as
select
  (select id from profiles where dorsal_number = 1) as mujer_id,     -- Marta, running 5
  (select id from profiles where dorsal_number = 2) as hombre_id,    -- Javi, running 4
  -- A plan the joiner does not host: join_plan() rejects the host of a plan
  -- before it ever looks at levels or capacity.
  (select id from plans
    where is_seed and sport = 'running' and audience = 'todos'
      and 5 between level_min and level_max
      and host_id <> (select id from profiles where dorsal_number = 1)
    order by starts_at limit 1) as joinable_plan_id,
  (select id from plans
    where is_seed and sport = 'running' and audience = 'todos' and level_min > 4
      and host_id <> (select id from profiles where dorsal_number = 2)
    order by starts_at limit 1) as too_fast_plan_id;
grant select on _fixtures to authenticated, anon;

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

  raise notice 'ok  every public table has RLS and at least one policy';
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
  raise notice 'ok  seed loaded: % venues, % profiles, % plans, all upcoming',
    v_venues, v_profiles, v_plans;
end $$;

-- ── 3. seeded venues are labelled unverified ────────────────────────────────
-- Their coordinates were written from general knowledge. Until someone
-- confirms them against a real source they must not read as confirmed.
do $$
declare n int;
begin
  select count(*) into n from venues where is_seed and verified;
  assert n = 0, n || ' seeded venues are marked verified without being confirmed';
  raise notice 'ok  every seeded venue is still flagged unverified';
end $$;

-- ── 4. anon sees nothing ────────────────────────────────────────────────────
set local role anon;
do $$ begin
  assert (select count(*) from plans)           = 0, 'anon can read plans';
  assert (select count(*) from profiles)        = 0, 'anon can read profiles';
  assert (select count(*) from venues)          = 0, 'anon can read venues';
  assert (select count(*) from public_profiles) = 0, 'anon can read public_profiles';
  raise notice 'ok  anon sees nothing';
end $$;

set local role authenticated;
do $$ begin
  perform test_as(null);
  assert (select count(*) from plans)    = 0, 'authenticated-with-no-subject can read plans';
  assert (select count(*) from profiles) = 0, 'authenticated-with-no-subject can read profiles';
  raise notice 'ok  a session with no subject sees nothing';
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
  raise notice 'ok  solo mujeres is invisible through every query path';
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
  raise notice 'ok  public_profiles exposes only roster fields';
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
  raise notice 'ok  join_plan works and refuses out-of-band levels';
end $$;

rollback;
