-- RLS and visibility. Every one of these is a claim 01-PRD makes about safety;
-- an untested claim is a promise, not a control.
--
-- Fixtures are created as the table owner (RLS bypassed), then every assertion
-- runs under `set role authenticated` with a JWT subject set, which is exactly
-- how PostgREST reaches these tables.

create or replace function test_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end;
$$;

begin;

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', 'bruno@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c1', 'carla@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d1', 'diego@test.invalid');

insert into profiles (id, display_name, birth_year, distrito, gender) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ana',   1995, 'Chamberí',  'mujer'),
  ('00000000-0000-0000-0000-0000000000b1', 'Bruno', 1993, 'Centro',    'hombre'),
  ('00000000-0000-0000-0000-0000000000c1', 'Carla', 1997, 'Salamanca', 'mujer'),
  ('00000000-0000-0000-0000-0000000000d1', 'Diego', 1990, 'Retiro',    'hombre');

insert into user_sports (user_id, sport, level_norm) values
  ('00000000-0000-0000-0000-0000000000a1', 'running', 5),
  ('00000000-0000-0000-0000-0000000000b1', 'running', 5),
  ('00000000-0000-0000-0000-0000000000c1', 'running', 5),
  ('00000000-0000-0000-0000-0000000000d1', 'running', 10);

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000000f1', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);

insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, audience, venue_id) values
  -- abierto: everyone can see it
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 2, 'todos',
   '00000000-0000-0000-0000-0000000000f1'),
  -- solo mujeres
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000a1',
   'running', now() + interval '4 days', 'Retiro', 4, 6, '7 km', 6, 'solo_mujeres',
   '00000000-0000-0000-0000-0000000000f1'),
  -- hosted by Diego, who Bruno will block
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000d1',
   'running', now() + interval '5 days', 'Retiro', 4, 6, '10 km', 6, 'todos',
   '00000000-0000-0000-0000-0000000000f1'),
  -- gated on the maximum the schema now allows: two completed plans
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-0000000000a1',
   'running', now() + interval '6 days', 'Retiro', 4, 6, '5 km', 6, 'todos',
   '00000000-0000-0000-0000-0000000000f1');
update plans set min_plans_required = 2 where id = '00000000-0000-0000-0000-00000000e004';

insert into blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1');

set role authenticated;

-- ── 1. anonymous callers see nothing ─────────────────────────────────────────
-- Both shapes: the anon role, and the authenticated role with no subject.
do $$ begin
  perform test_as(null);
  assert (select count(*) from plans)    = 0, 'authenticated-with-no-subject can read plans';
  assert (select count(*) from profiles) = 0, 'authenticated-with-no-subject can read profiles';
  assert (select count(*) from venues)   = 0, 'authenticated-with-no-subject can read venues';
end $$;
set role anon;
do $$ begin
  assert (select count(*) from plans)    = 0, 'anon can read plans';
  assert (select count(*) from profiles) = 0, 'anon can read profiles';
  assert (select count(*) from venues)   = 0, 'anon can read venues';
  assert (select count(*) from public_profiles) = 0, 'anon can read public_profiles';
  raise notice 'ok  anon sees nothing';
end $$;
set role authenticated;

-- ── 2. solo_mujeres is invisible to everyone else, in every query path ───────
-- 02-DATA-MODEL §Domain rules 6. The filter lives in the RLS policy precisely
-- so that deck, detail, share link and notification cannot each forget it.
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b1');  -- hombre
  select count(*) into n from plans where audience = 'solo_mujeres';
  assert n = 0, 'a man can see a solo_mujeres plan';
  select count(*) into n from plans where id = '00000000-0000-0000-0000-00000000e002';
  assert n = 0, 'solo_mujeres plan readable by id';
  select count(*) into n from plan_participants where plan_id = '00000000-0000-0000-0000-00000000e002';
  assert n = 0, 'roster of a solo_mujeres plan is readable';

  perform test_as('00000000-0000-0000-0000-0000000000c1');  -- mujer
  select count(*) into n from plans where id = '00000000-0000-0000-0000-00000000e002';
  assert n = 1, 'a woman cannot see the solo_mujeres plan';
  raise notice 'ok  solo_mujeres visibility';
end $$;

-- ── 3. blocked pairs disappear from each other ──────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b1');  -- blocked Diego
  select count(*) into n from profiles where id = '00000000-0000-0000-0000-0000000000d1';
  assert n = 0, 'blocker can still see the blocked profile';
  select count(*) into n from plans where host_id = '00000000-0000-0000-0000-0000000000d1';
  assert n = 0, 'blocker can still see the blocked host''s plans';

  perform test_as('00000000-0000-0000-0000-0000000000d1');  -- the blocked side
  select count(*) into n from profiles where id = '00000000-0000-0000-0000-0000000000b1';
  assert n = 0, 'block is not symmetric';
  raise notice 'ok  blocks are symmetric and hide plans';
end $$;

-- ── 4. public_profiles exposes only what a roster needs ─────────────────────
do $$
declare cols text[];
begin
  select array_agg(column_name::text order by column_name) into cols
    from information_schema.columns
   where table_name = 'public_profiles';
  assert not ('gender' = any(cols)),     'public_profiles leaks gender';
  assert not ('birth_year' = any(cols)), 'public_profiles leaks birth_year';
  assert not ('is_suspended' = any(cols)), 'public_profiles leaks moderation state';
  raise notice 'ok  public_profiles column set';
end $$;

-- ── 5. join_plan enforces every gate ────────────────────────────────────────
do $$
declare r join_status;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b1');
  begin
    r := join_plan('00000000-0000-0000-0000-00000000e002');  -- solo mujeres
    assert false, 'a man joined a solo_mujeres plan';
  exception when others then assert sqlerrm = 'solo_mujeres', 'wrong error: ' || sqlerrm; end;

  begin
    r := join_plan('00000000-0000-0000-0000-00000000e003');  -- blocked host
    assert false, 'joined a plan hosted by a blocked user';
  exception when others then assert sqlerrm = 'blocked', 'wrong error: ' || sqlerrm; end;

  begin
    r := join_plan('00000000-0000-0000-0000-00000000e004');  -- needs 3 plans
    assert false, 'joined a gated plan with no history';
  exception when others then assert sqlerrm = 'needs_more_plans', 'wrong error: ' || sqlerrm; end;

  perform test_as('00000000-0000-0000-0000-0000000000d1');   -- level 10, band is 4–6
  begin
    r := join_plan('00000000-0000-0000-0000-00000000e001');
    assert false, 'joined a plan outside the level band';
  exception when others then assert sqlerrm in ('level_mismatch','blocked'), 'wrong error: ' || sqlerrm; end;

  perform test_as('00000000-0000-0000-0000-0000000000a1');   -- the host
  begin
    r := join_plan('00000000-0000-0000-0000-00000000e001');
    assert false, 'host joined their own plan';
  exception when others then assert sqlerrm = 'host_cannot_join', 'wrong error: ' || sqlerrm; end;
  raise notice 'ok  join_plan gates';
end $$;

-- ── 6. a new user always has somewhere to start ─────────────────────────────
-- 02-DATA-MODEL §Domain rules 8: gates must never close the door on everyone.
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000c1');
  select count(*) into n from plans
   where status = 'open' and min_plans_required = 0 and starts_at > now();
  assert n > 0, 'a brand-new user has no joinable plan at all';
  raise notice 'ok  newcomer has open plans (%)', n;
end $$;

-- ── 7. capacity, waitlist and the counter ───────────────────────────────────
do $$
declare r join_status; p plans%rowtype;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b1');
  r := join_plan('00000000-0000-0000-0000-00000000e001');
  assert r = 'joined', 'first joiner not joined: ' || r;

  perform test_as('00000000-0000-0000-0000-0000000000c1');
  r := join_plan('00000000-0000-0000-0000-00000000e001');
  assert r = 'joined', 'second joiner not joined: ' || r;
  r := join_plan('00000000-0000-0000-0000-00000000e001');
  assert r = 'joined', 'joining twice changed the status';

  select * into p from plans where id = '00000000-0000-0000-0000-00000000e001';
  assert p.joined_count = 2, 'joined_count wrong: ' || p.joined_count;
  assert p.status = 'full', 'plan did not flip to full: ' || p.status;
  raise notice 'ok  capacity, idempotent join, full status';
end $$;

-- ── 8. participants cannot rewrite each other ───────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b1');
  update plan_participants set status = 'attended'
   where plan_id = '00000000-0000-0000-0000-00000000e001'
     and user_id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics n = row_count;
  assert n = 0, 'a participant marked someone else as attended';

  -- and no one can insert a membership directly; joining goes through join_plan
  begin
    insert into plan_participants (plan_id, user_id)
    values ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000b1');
    assert false, 'direct insert into plan_participants succeeded';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  participant rows are not writable by peers';
end $$;

-- ── 9. the 18+ floor is enforced by the database, not just the form ─────────
do $$ begin
  reset role;
  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'nino@test.invalid');
    insert into profiles (id, display_name, birth_year, distrito)
    values ('00000000-0000-0000-0000-0000000000e1', 'Niño',
            extract(year from now())::int - 17, 'Centro');
    assert false, 'a 17-year-old profile was accepted';
  exception when check_violation then null; end;
  raise notice 'ok  18+ enforced in the database';
end $$;

rollback;
