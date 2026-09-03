-- Palabra. 02-DATA-MODEL §Domain rules 5 and 8, and 01-PRD §Palabra.

begin;

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000005' || lpad(i::text,2,'0'))::uuid, 'p5_' || i || '@test.invalid'
  from generate_series(1, 9) i;
insert into profiles (id, display_name, birth_year, distrito)
select ('00000000-0000-0000-0000-0000000005' || lpad(i::text,2,'0'))::uuid,
       'P' || i, 1995, 'Centro' from generate_series(1, 9) i;
insert into user_sports (user_id, sport, level_norm)
select ('00000000-0000-0000-0000-0000000005' || lpad(i::text,2,'0'))::uuid, 'running', 5
  from generate_series(1, 9) i;

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000005f0', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);

-- p501 hosts everything.
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id) values
  ('00000000-0000-0000-0000-0000000005a0', '00000000-0000-0000-0000-000000000501',
   'running', now() + interval '2 days', 'Retiro', 4, 6, '8 km', 8,
   '00000000-0000-0000-0000-0000000005f0');

set role authenticated;
do $$ begin
  perform test_as('00000000-0000-0000-0000-000000000502'); perform join_plan('00000000-0000-0000-0000-0000000005a0');
  perform test_as('00000000-0000-0000-0000-000000000503'); perform join_plan('00000000-0000-0000-0000-0000000005a0');
  perform test_as('00000000-0000-0000-0000-000000000504'); perform join_plan('00000000-0000-0000-0000-0000000005a0');
  perform test_as('00000000-0000-0000-0000-000000000505'); perform join_plan('00000000-0000-0000-0000-0000000005a0');
end $$;
reset role;

-- The plan happened yesterday. created_at moves with it: plans.future_start
-- compares the two columns, not either against now().
update plans set created_at = now() - interval '4 days', starts_at = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-0000000005a0';

set role authenticated;

-- ── 1. both sides agree: attended ───────────────────────────────────────────
do $$
declare v_status join_status; n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000501');
  perform mark_attendance('00000000-0000-0000-0000-0000000005a0',
                          '00000000-0000-0000-0000-000000000502', true);
  perform test_as('00000000-0000-0000-0000-000000000502');
  perform confirm_attendance('00000000-0000-0000-0000-0000000005a0', true);

  select status into v_status from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000005a0'
     and user_id = '00000000-0000-0000-0000-000000000502';
  assert v_status = 'attended', 'status after agreement: ' || v_status;

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000502' and kind = 'attended';
  assert n = 1, 'attended events: ' || n;
  raise notice 'ok  both sides agree, attendance recorded';
end $$;

-- ── 2. both sides agree: a no-show, from both sides ─────────────────────────
-- This is the milestone's "done when".
do $$
declare v_status join_status; n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000501');
  perform mark_attendance('00000000-0000-0000-0000-0000000005a0',
                          '00000000-0000-0000-0000-000000000503', false);
  perform test_as('00000000-0000-0000-0000-000000000503');
  perform confirm_attendance('00000000-0000-0000-0000-0000000005a0', false);

  select status into v_status from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000005a0'
     and user_id = '00000000-0000-0000-0000-000000000503';
  assert v_status = 'no_show', 'status after an agreed no-show: ' || v_status;

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000503' and kind = 'no_show';
  assert n = 1, 'no_show events: ' || n;
  raise notice 'ok  a no-show is recorded when both sides say so';
end $$;

-- ── 3. disagreement penalises nobody ────────────────────────────────────────
do $$
declare n int; v_settled timestamptz;
begin
  perform test_as('00000000-0000-0000-0000-000000000501');
  perform mark_attendance('00000000-0000-0000-0000-0000000005a0',
                          '00000000-0000-0000-0000-000000000504', false);
  perform test_as('00000000-0000-0000-0000-000000000504');
  perform confirm_attendance('00000000-0000-0000-0000-0000000005a0', true);

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000504'
     and kind in ('attended','no_show');
  assert n = 0, 'a disputed attendance was recorded either way: ' || n;

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000504' and kind = 'disputed';
  assert n = 1, 'the dispute was not logged: ' || n;

  select settled_at into v_settled from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000005a0'
     and user_id = '00000000-0000-0000-0000-000000000504';
  assert v_settled is not null, 'a disputed row was left unsettled';
  raise notice 'ok  a disagreement penalises nobody and is logged as a dispute';
end $$;

-- ── 4. one side only: nothing happens inside 72 hours ───────────────────────
do $$
declare v_status join_status; n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000505');
  perform confirm_attendance('00000000-0000-0000-0000-0000000005a0', true);

  select status into v_status from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000005a0'
     and user_id = '00000000-0000-0000-0000-000000000505';
  assert v_status = 'joined', 'settled on one answer inside the window: ' || v_status;
  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000505' and kind = 'attended';
  assert n = 0, 'recorded before the other side had a chance';
  raise notice 'ok  one answer inside 72h settles nothing';
end $$;

-- ── 5. …and is trusted once the window closes ───────────────────────────────
do $$
declare v_status join_status; v_one boolean;
begin
  reset role;
  update plans set created_at = now() - interval '10 days', starts_at = now() - interval '6 days'
   where id = '00000000-0000-0000-0000-0000000005a0';
  set role authenticated;

  perform test_as('00000000-0000-0000-0000-000000000505');
  perform settle_my_overdue_plans();

  select status, one_sided into v_status, v_one from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000005a0'
     and user_id = '00000000-0000-0000-0000-000000000505';
  assert v_status = 'attended', 'the only answer given was not trusted: ' || v_status;
  assert v_one, 'the row was not marked one-sided';
  raise notice 'ok  after 72h the side that answered is trusted, and marked as such';
end $$;

-- ── 6. marking is the host's, and only after the plan ───────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-000000000502');
  begin
    perform mark_attendance('00000000-0000-0000-0000-0000000005a0',
                            '00000000-0000-0000-0000-000000000505', false);
    assert false, 'a participant marked the roster';
  exception when others then assert sqlerrm = 'not_host', 'wrong error: ' || sqlerrm; end;
  raise notice 'ok  only the host marks the roster';
end $$;

-- ── 7. the gate is capped at two ────────────────────────────────────────────
do $$ begin
  reset role;
  begin
    update plans set min_plans_required = 5 where id = '00000000-0000-0000-0000-0000000005a0';
    assert false, 'a host could gate a plan on five plans';
  exception when check_violation then null; end;
  set role authenticated;
  raise notice 'ok  the minimum-plans gate cannot exceed two';
end $$;

-- ── 8. a reserved plaza for someone with no history ─────────────────────────
-- p506 has one attended plan; p507 has none.
do $$
declare r join_status;
begin
  reset role;
  insert into reliability_events (user_id, kind)
  values ('00000000-0000-0000-0000-000000000506', 'attended');

  insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                     level_display, capacity, venue_id)
  values ('00000000-0000-0000-0000-0000000005b0', '00000000-0000-0000-0000-000000000501',
          'running', now() + interval '2 days', 'Retiro', 4, 6, '8 km', 4,
          '00000000-0000-0000-0000-0000000005f0');
  set role authenticated;

  -- Three of the four plazas fill with people who have history.
  perform test_as('00000000-0000-0000-0000-000000000502');
  r := join_plan('00000000-0000-0000-0000-0000000005b0');
  assert r = 'joined', 'first: ' || r;
  perform test_as('00000000-0000-0000-0000-000000000508');
  r := join_plan('00000000-0000-0000-0000-0000000005b0');
  assert r = 'joined', 'second: ' || r;
  perform test_as('00000000-0000-0000-0000-000000000509');
  r := join_plan('00000000-0000-0000-0000-0000000005b0');
  assert r = 'joined', 'third: ' || r;

  -- The fourth is held for a newcomer, so someone with history waits.
  perform test_as('00000000-0000-0000-0000-000000000506');
  r := join_plan('00000000-0000-0000-0000-0000000005b0');
  assert r = 'waitlist', 'an established user took the reserved plaza: ' || r;

  -- And the newcomer gets it.
  perform test_as('00000000-0000-0000-0000-000000000507');
  r := join_plan('00000000-0000-0000-0000-0000000005b0');
  assert r = 'joined', 'a newcomer could not take the reserved plaza: ' || r;
  raise notice 'ok  one plaza on an ungated plan is held for someone with no history';
end $$;

-- ── 9. two faltas in thirty days is a cooldown, not a ban ───────────────────
do $$
declare r join_status;
begin
  reset role;
  insert into reliability_events (user_id, kind) values
    ('00000000-0000-0000-0000-000000000502', 'no_show'),
    ('00000000-0000-0000-0000-000000000502', 'late_cancel');

  -- One nearly full (4 of 5 = 80%), one nearly empty.
  insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                     level_display, capacity, venue_id, min_plans_required) values
    ('00000000-0000-0000-0000-0000000005c0', '00000000-0000-0000-0000-000000000501',
     'running', now() + interval '2 days', 'Retiro', 4, 6, '8 km', 5,
     '00000000-0000-0000-0000-0000000005f0', 0),
    ('00000000-0000-0000-0000-0000000005d0', '00000000-0000-0000-0000-000000000501',
     'running', now() + interval '2 days', 'Retiro', 4, 6, '8 km', 8,
     '00000000-0000-0000-0000-0000000005f0', 0);
  set role authenticated;

  perform test_as('00000000-0000-0000-0000-000000000503');
  perform join_plan('00000000-0000-0000-0000-0000000005c0');
  perform test_as('00000000-0000-0000-0000-000000000504');
  perform join_plan('00000000-0000-0000-0000-0000000005c0');
  perform test_as('00000000-0000-0000-0000-000000000505');
  perform join_plan('00000000-0000-0000-0000-0000000005c0');
  perform test_as('00000000-0000-0000-0000-000000000506');
  perform join_plan('00000000-0000-0000-0000-0000000005c0');

  perform test_as('00000000-0000-0000-0000-000000000502');
  begin
    r := join_plan('00000000-0000-0000-0000-0000000005c0');
    assert false, 'someone on cooldown joined a nearly full plan: ' || r;
  exception when others then assert sqlerrm = 'cooldown', 'wrong error: ' || sqlerrm; end;

  -- The emptier plan is still open to them: this is a cooldown, not a ban.
  r := join_plan('00000000-0000-0000-0000-0000000005d0');
  assert r = 'joined', 'the cooldown became a ban: ' || r;
  raise notice 'ok  two faltas close the full plans, not the product';
end $$;

-- ── 10. what other people are allowed to see ────────────────────────────────
do $$
declare v_plans int; v_pct int; v_new boolean;
begin
  perform test_as('00000000-0000-0000-0000-000000000503');
  select plans, attendance_pct, is_newcomer into v_plans, v_pct, v_new
    from public_palabra('00000000-0000-0000-0000-000000000502');
  assert v_plans = 1, 'plans attended: ' || v_plans;
  assert v_pct is not null and v_pct between 0 and 100, 'attendance: ' || coalesce(v_pct, -1);
  assert not v_new, 'someone with a record read as new';

  select is_newcomer into v_new from public_palabra('00000000-0000-0000-0000-000000000507');
  assert v_new, 'someone with no record did not read as new';

  -- The raw events stay private no matter who asks.
  assert (select count(*) from reliability_events
           where user_id = '00000000-0000-0000-0000-000000000502') = 0,
    'one user read another''s reliability events';
  raise notice 'ok  others see three numbers, never the events and never a rank';
end $$;

rollback;
