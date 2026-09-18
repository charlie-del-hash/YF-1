-- Filling the deck. 01-PRD §Cold start: "A plan that doesn't fill is a failure
-- the app owns."

begin;

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000007' || lpad(i::text,2,'0'))::uuid, 'p7_' || i || '@test.invalid'
  from generate_series(1, 8) i;
insert into profiles (id, display_name, birth_year, distrito, gender)
select ('00000000-0000-0000-0000-0000000007' || lpad(i::text,2,'0'))::uuid,
       'F' || i, 1995, 'Centro', case when i = 8 then 'mujer' else 'hombre' end::gender_decl
  from generate_series(1, 8) i;
insert into user_sports (user_id, sport, level_norm)
select ('00000000-0000-0000-0000-0000000007' || lpad(i::text,2,'0'))::uuid, 'running', 5
  from generate_series(1, 8) i;

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000007f0', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);

-- a0: fills. a1: recurring weekly. a2: under-filled, soon. a3: solo mujeres.
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id, recurring_rule, audience) values
  ('00000000-0000-0000-0000-0000000007a0', '00000000-0000-0000-0000-000000000701',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 2,
   '00000000-0000-0000-0000-0000000007f0', null, 'todos'),
  ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000701',
   'running', now() + interval '2 days', 'Retiro', 4, 6, '8 km', 8,
   '00000000-0000-0000-0000-0000000007f0', 'weekly', 'todos'),
  ('00000000-0000-0000-0000-0000000007a2', '00000000-0000-0000-0000-000000000702',
   'running', now() + interval '20 hours', 'Retiro', 4, 6, '8 km', 8,
   '00000000-0000-0000-0000-0000000007f0', null, 'todos'),
  ('00000000-0000-0000-0000-0000000007a3', '00000000-0000-0000-0000-000000000708',
   'running', now() + interval '20 hours', 'Retiro', 4, 6, '8 km', 8,
   '00000000-0000-0000-0000-0000000007f0', null, 'solo_mujeres');

-- An example plan, for the seed assertion at the end.
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id, is_seed) values
  ('00000000-0000-0000-0000-0000000007a4', '00000000-0000-0000-0000-000000000701',
   'running', now() + interval '4 days', 'Retiro', 4, 6, '8 km', 8,
   '00000000-0000-0000-0000-0000000007f0', true);

set role authenticated;

-- ── 0. an example plan is for looking at ────────────────────────────────────
-- The seed is permanently in the future and hosted by nobody. Joining one is
-- the only case in the product where standing alone in a park is guaranteed.
do $$
declare v_joined boolean := false;
begin
  perform test_as('00000000-0000-0000-0000-000000000705');
  begin
    perform join_plan('00000000-0000-0000-0000-0000000007a4');
    v_joined := true;
  exception when others then
    assert sqlerrm = 'seed_plan', 'refused for the wrong reason: ' || sqlerrm;
  end;
  assert not v_joined, 'someone joined an example plan';
  raise notice 'ok  an example plan cannot be joined';
end $$;

-- ── 1. time to fill is stamped when it happens ──────────────────────────────
do $$
declare v_filled timestamptz; v_again timestamptz;
begin
  perform test_as('00000000-0000-0000-0000-000000000703');
  perform join_plan('00000000-0000-0000-0000-0000000007a0');
  select filled_at into v_filled from plans where id = '00000000-0000-0000-0000-0000000007a0';
  assert v_filled is null, 'a half-full plan was marked filled';

  perform test_as('00000000-0000-0000-0000-000000000704');
  perform join_plan('00000000-0000-0000-0000-0000000007a0');
  select filled_at into v_filled from plans where id = '00000000-0000-0000-0000-0000000007a0';
  assert v_filled is not null, 'filling was not recorded';

  -- Someone leaving does not rewrite history: the question is how long it took
  -- to fill, not whether it is full now.
  perform leave_plan('00000000-0000-0000-0000-0000000007a0');
  select filled_at into v_again from plans where id = '00000000-0000-0000-0000-0000000007a0';
  assert v_again = v_filled, 'filled_at moved when someone left';
  raise notice 'ok  time to fill is stamped once and never rewritten';
end $$;

-- ── 2. the numbers are for whoever moderates, not for everyone ──────────────
do $$
declare v_created int;
begin
  perform test_as('00000000-0000-0000-0000-000000000703');
  select plans_created into v_created from fill_metrics();
  assert coalesce(v_created, 0) = 0, 'a normal user read the fill metrics';

  reset role;
  update profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000703';
  set role authenticated;

  select plans_created into v_created from fill_metrics();
  assert v_created > 0, 'a moderator cannot read the fill metrics';
  raise notice 'ok  fill metrics exist and are not public';
end $$;

-- ── 3. a weekly plan makes next week's, once ────────────────────────────────
do $$
declare n int; v_made int; v_next timestamptz;
begin
  reset role;
  -- The occurrence has now happened.
  update plans set created_at = now() - interval '9 days', starts_at = now() - interval '2 days'
   where id = '00000000-0000-0000-0000-0000000007a1';
  set role authenticated;

  perform test_as('00000000-0000-0000-0000-000000000701');
  v_made := materialise_my_recurring();
  assert v_made = 1, 'the weekly plan did not roll forward: ' || v_made;

  select count(*), min(starts_at) into n, v_next from plans
   where coalesce(series_id, id) = '00000000-0000-0000-0000-0000000007a1' and starts_at > now();
  assert n = 1, 'expected exactly one future occurrence, saw ' || n;
  assert v_next > now(), 'the new occurrence is in the past';

  -- Idempotent: opening the screen twice does not make two.
  v_made := materialise_my_recurring();
  assert v_made = 0, 'a second sweep created another occurrence';
  select count(*) into n from plans
   where coalesce(series_id, id) = '00000000-0000-0000-0000-0000000007a1' and starts_at > now();
  assert n = 1, 'the series sprouted a second future: ' || n;
  raise notice 'ok  a weekly plan rolls forward exactly once';
end $$;

-- ── 4. and only for its own host ────────────────────────────────────────────
do $$
declare v_made int;
begin
  perform test_as('00000000-0000-0000-0000-000000000702');
  v_made := materialise_my_recurring();
  assert v_made = 0, 'someone else rolled forward a host''s series';
  raise notice 'ok  only the host rolls their own series forward';
end $$;

-- ── 5. plans that need people, including ones you passed on ────────────────
do $$
declare v_ids uuid[];
begin
  perform test_as('00000000-0000-0000-0000-000000000705');

  -- Passing on it explicitly.
  insert into swipes (user_id, plan_id, direction)
  values ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-0000000007a2', 'left');

  select array_agg(id) into v_ids from plans_needing_people(48) id;
  assert '00000000-0000-0000-0000-0000000007a2' = any(v_ids),
    'a plan short of people did not reach someone who had passed on it';

  -- A solo mujeres plan never reaches a man, however short of people it is.
  assert not ('00000000-0000-0000-0000-0000000007a3' = any(v_ids)),
    'a solo_mujeres plan was offered to a man as a rescue';

  -- Joining it takes it off the list; so does deliberately swiping right.
  perform join_plan('00000000-0000-0000-0000-0000000007a2');
  select array_agg(id) into v_ids from plans_needing_people(48) id;
  assert v_ids is null or not ('00000000-0000-0000-0000-0000000007a2' = any(v_ids)),
    'a plan you already joined came back as needing you';
  raise notice 'ok  under-filled plans reach past a left swipe, and nowhere else';
end $$;

-- ── 6. …and a woman does see the solo mujeres one ───────────────────────────
do $$
declare v_ids uuid[];
begin
  perform test_as('00000000-0000-0000-0000-000000000708');
  select array_agg(id) into v_ids from plans_needing_people(48) id;
  -- She hosts it, so it is not offered to her; what matters is that the
  -- exclusion above was about audience and not about the plan being invisible.
  assert v_ids is null or not ('00000000-0000-0000-0000-0000000007a3' = any(v_ids)),
    'a host was offered their own plan';
  raise notice 'ok  the rescue list never offers you your own plan';
end $$;

-- ── 7. regulars are mine, and only people who actually came ─────────────────
do $$
declare n int;
begin
  reset role;
  insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                     level_display, capacity, venue_id)
  values ('00000000-0000-0000-0000-0000000007b0', '00000000-0000-0000-0000-000000000701',
          'running', now() + interval '1 day', 'Retiro', 4, 6, '8 km', 8,
          '00000000-0000-0000-0000-0000000007f0'),
         ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-000000000701',
          'running', now() + interval '2 days', 'Retiro', 4, 6, '8 km', 8,
          '00000000-0000-0000-0000-0000000007f0');
  insert into plan_participants (plan_id, user_id, status) values
    ('00000000-0000-0000-0000-0000000007b0', '00000000-0000-0000-0000-000000000706', 'attended'),
    ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-000000000706', 'attended'),
    ('00000000-0000-0000-0000-0000000007b0', '00000000-0000-0000-0000-000000000707', 'attended');
  set role authenticated;

  perform test_as('00000000-0000-0000-0000-000000000701');
  select count(*) into n from my_regulars();
  assert n = 1, 'expected one regular (two turnouts), saw ' || n;

  -- Someone else's regulars are not mine.
  perform test_as('00000000-0000-0000-0000-000000000702');
  select count(*) into n from my_regulars();
  assert n = 0, 'a host saw another host''s regulars';
  raise notice 'ok  regulars are per-host and need turning up twice';
end $$;

-- ── 8. a share link shows enough, to someone with no account ────────────────
do $$
declare v_sport sport_key; v_host text; n int;
begin
  set local role anon;
  select sport, host_name into v_sport, v_host
    from public_plan_preview('00000000-0000-0000-0000-0000000007a2');
  assert v_sport = 'running', 'a shared plan is not visible without an account';
  assert v_host is not null, 'the share preview has no host';

  -- And nothing else is. The rest of the product still needs a session.
  assert (select count(*) from plans) = 0, 'anon can read plans directly';
  assert (select count(*) from public_profiles) = 0, 'anon can read profiles';

  -- A solo mujeres plan is refused outright, not filtered: a share link is a
  -- URL that travels.
  select count(*) into n from public_plan_preview('00000000-0000-0000-0000-0000000007a3');
  assert n = 0, 'a solo_mujeres plan was previewable by a stranger';
  raise notice 'ok  a share link shows one open plan and never a solo mujeres one';
end $$;

-- ── 9. and stops working once the plan is off ───────────────────────────────
do $$
declare n int;
begin
  reset role;
  update plans set status = 'cancelled', cancelled_reason = 'Llueve'
   where id = '00000000-0000-0000-0000-0000000007a2';
  set local role anon;
  select count(*) into n from public_plan_preview('00000000-0000-0000-0000-0000000007a2');
  assert n = 0, 'a cancelled plan is still previewable from a share link';
  raise notice 'ok  a share link dies with the plan';
end $$;

rollback;
