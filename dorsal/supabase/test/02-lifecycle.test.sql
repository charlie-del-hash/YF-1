-- Leaving, waitlist promotion, editing and cancelling.
-- 02-DATA-MODEL §Domain rules 2, 3 and 4.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'ana2@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b2', 'bruno2@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c2', 'carla2@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d2', 'diego2@test.invalid'),
  ('00000000-0000-0000-0000-0000000000e2', 'elena2@test.invalid');

insert into profiles (id, display_name, birth_year, distrito) values
  ('00000000-0000-0000-0000-0000000000a2', 'Ana',   1995, 'Chamberí'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 1993, 'Centro'),
  ('00000000-0000-0000-0000-0000000000c2', 'Carla', 1997, 'Salamanca'),
  ('00000000-0000-0000-0000-0000000000d2', 'Diego', 1990, 'Retiro'),
  ('00000000-0000-0000-0000-0000000000e2', 'Elena', 1994, 'Centro');

insert into user_sports (user_id, sport, level_norm) values
  ('00000000-0000-0000-0000-0000000000a2', 'running', 5),
  ('00000000-0000-0000-0000-0000000000b2', 'running', 5),
  ('00000000-0000-0000-0000-0000000000c2', 'running', 5),
  ('00000000-0000-0000-0000-0000000000d2', 'running', 5),
  ('00000000-0000-0000-0000-0000000000e2', 'running', 5);

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000000f2', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);

-- far: three days out. soon: six hours out. ee03: two plazas and four takers,
-- which is the smallest plan on which promotion *order* is observable
-- (capacity has a floor of 2).
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id) values
  ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-0000000000a2',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 6,
   '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-0000000000a2',
   'running', now() + interval '6 hours', 'Retiro', 4, 6, '8 km', 6,
   '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-00000000ee03', '00000000-0000-0000-0000-0000000000a2',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 2,
   '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-00000000ee04', '00000000-0000-0000-0000-0000000000a2',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 4,
   '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-00000000ee05', '00000000-0000-0000-0000-0000000000a2',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 4,
   '00000000-0000-0000-0000-0000000000f2');

set role authenticated;

-- ── 1. leaving in good time is free ─────────────────────────────────────────
do $$
declare cost text; n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b2');
  perform join_plan('00000000-0000-0000-0000-00000000ee01');
  cost := leave_plan('00000000-0000-0000-0000-00000000ee01');
  assert cost = 'early_cancel', 'leaving three days out cost: ' || cost;

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-0000000000b2' and kind = 'early_cancel';
  assert n = 1, 'early_cancel not recorded';

  select joined_count into n from plans where id = '00000000-0000-0000-0000-00000000ee01';
  assert n = 0, 'the plaza was not freed: ' || n;
  raise notice 'ok  leaving early is free and frees the plaza';
end $$;

-- ── 2. leaving under twelve hours is a falta ────────────────────────────────
do $$
declare cost text; n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b2');
  perform join_plan('00000000-0000-0000-0000-00000000ee02');
  cost := leave_plan('00000000-0000-0000-0000-00000000ee02');
  assert cost = 'late_cancel', 'leaving six hours out cost: ' || cost;

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-0000000000b2' and kind = 'late_cancel';
  assert n = 1, 'late_cancel not recorded';
  raise notice 'ok  leaving under 12h is a falta';
end $$;

-- ── 3. the boundary is where the rule says it is ────────────────────────────
-- The UI asks leave_cost() rather than computing this, so the words on the
-- confirmation and the row written can never disagree.
do $$ begin
  assert late_cancel_threshold() = interval '12 hours', 'the threshold moved';
  assert leave_cost('00000000-0000-0000-0000-00000000ee01') = 'early_cancel', 'far plan misread';
  assert leave_cost('00000000-0000-0000-0000-00000000ee02') = 'late_cancel', 'near plan misread';
  raise notice 'ok  the 12h boundary is one definition';
end $$;

-- ── 4. waitlist promotion ───────────────────────────────────────────────────
do $$
declare r join_status; s join_status; n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b2');
  r := join_plan('00000000-0000-0000-0000-00000000ee03');
  assert r = 'joined', 'first joiner: ' || r;

  perform test_as('00000000-0000-0000-0000-0000000000c2');
  r := join_plan('00000000-0000-0000-0000-00000000ee03');
  assert r = 'joined', 'second joiner: ' || r;

  perform test_as('00000000-0000-0000-0000-0000000000d2');
  r := join_plan('00000000-0000-0000-0000-00000000ee03');
  assert r = 'waitlist', 'third joiner on a full plan: ' || r;

  perform test_as('00000000-0000-0000-0000-0000000000e2');
  r := join_plan('00000000-0000-0000-0000-00000000ee03');
  assert r = 'waitlist', 'fourth joiner: ' || r;

  -- A plaza-holder leaves; the first person who waited takes it, not the last.
  perform test_as('00000000-0000-0000-0000-0000000000b2');
  perform leave_plan('00000000-0000-0000-0000-00000000ee03');

  select status into s from plan_participants
   where plan_id = '00000000-0000-0000-0000-00000000ee03'
     and user_id = '00000000-0000-0000-0000-0000000000d2';
  assert s = 'joined', 'first waitlisted was not promoted: ' || s;

  select status into s from plan_participants
   where plan_id = '00000000-0000-0000-0000-00000000ee03'
     and user_id = '00000000-0000-0000-0000-0000000000e2';
  assert s = 'waitlist', 'the queue jumped: ' || s;

  select joined_count into n from plans where id = '00000000-0000-0000-0000-00000000ee03';
  assert n = 2, 'the plan is over capacity after promotion: ' || n;
  raise notice 'ok  waitlist promotes in order and respects capacity';
end $$;

-- ── 5. giving up a waitlist place costs nothing ─────────────────────────────
do $$
declare cost text; n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000e2');
  cost := leave_plan('00000000-0000-0000-0000-00000000ee03');
  assert cost = 'waitlist_left', 'leaving the waitlist cost: ' || cost;

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-0000000000e2'
     and kind in ('early_cancel','late_cancel');
  assert n = 0, 'giving up a waitlist place was recorded as a cancellation';
  raise notice 'ok  leaving a waitlist place is not a cancellation';
end $$;

-- ── 6. who may leave, and who may not ───────────────────────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000000a2');   -- the host
  begin
    perform leave_plan('00000000-0000-0000-0000-00000000ee04');
    assert false, 'the host left their own plan';
  exception when others then assert sqlerrm = 'host_cannot_leave', 'wrong error: ' || sqlerrm; end;

  perform test_as('00000000-0000-0000-0000-0000000000c2');   -- never joined
  begin
    perform leave_plan('00000000-0000-0000-0000-00000000ee04');
    assert false, 'someone left a plan they were not in';
  exception when others then assert sqlerrm = 'not_joined', 'wrong error: ' || sqlerrm; end;
  raise notice 'ok  leaving is only for participants';
end $$;

-- ── 7. cancelling ───────────────────────────────────────────────────────────
do $$
declare v_status plan_status; v_reason text;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b2');   -- not the host
  begin
    perform cancel_plan('00000000-0000-0000-0000-00000000ee04', 'porque sí');
    assert false, 'a participant cancelled someone else''s plan';
  exception when others then assert sqlerrm = 'not_host', 'wrong error: ' || sqlerrm; end;

  perform test_as('00000000-0000-0000-0000-0000000000a2');
  begin
    perform cancel_plan('00000000-0000-0000-0000-00000000ee04', '   ');
    assert false, 'a plan was cancelled with no reason';
  exception when others then assert sqlerrm = 'reason_required', 'wrong error: ' || sqlerrm; end;

  perform cancel_plan('00000000-0000-0000-0000-00000000ee04', 'Aviso de lluvia');
  select status, cancelled_reason into v_status, v_reason
    from plans where id = '00000000-0000-0000-0000-00000000ee04';
  assert v_status = 'cancelled', 'plan not cancelled: ' || v_status;
  assert v_reason = 'Aviso de lluvia', 'reason not kept: ' || coalesce(v_reason, 'null');

  -- Cancelling twice is a no-op, not an error: the host tapped twice.
  perform cancel_plan('00000000-0000-0000-0000-00000000ee04', 'Aviso de lluvia');

  begin
    update plans set status = 'open' where id = '00000000-0000-0000-0000-00000000ee04';
    assert false, 'a cancelled plan was reopened';
  exception when others then
    assert sqlerrm = 'plan_already_cancelled', 'wrong error: ' || sqlerrm;
  end;
  raise notice 'ok  cancelling needs a reason, a host, and is final';
end $$;

-- ── 8. leaving a cancelled plan is never a falta ────────────────────────────
do $$
declare n int; cost text;
begin
  perform test_as('00000000-0000-0000-0000-0000000000a2');
  perform cancel_plan('00000000-0000-0000-0000-00000000ee02', 'No hay pista');

  perform test_as('00000000-0000-0000-0000-0000000000c2');
  perform join_plan('00000000-0000-0000-0000-00000000ee01');

  perform test_as('00000000-0000-0000-0000-0000000000a2');
  perform cancel_plan('00000000-0000-0000-0000-00000000ee01', 'Se moja');

  perform test_as('00000000-0000-0000-0000-0000000000c2');
  cost := leave_plan('00000000-0000-0000-0000-00000000ee01');
  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-0000000000c2'
     and plan_id = '00000000-0000-0000-0000-00000000ee01';
  assert n = 0, 'leaving a plan the host cancelled counted against the participant';
  raise notice 'ok  the host''s cancellation is not the participant''s falta';
end $$;

-- ── 9. capacity cannot drop below the people already in ─────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000000b2');
  perform join_plan('00000000-0000-0000-0000-00000000ee05');
  perform test_as('00000000-0000-0000-0000-0000000000c2');
  perform join_plan('00000000-0000-0000-0000-00000000ee05');
  perform test_as('00000000-0000-0000-0000-0000000000d2');
  perform join_plan('00000000-0000-0000-0000-00000000ee05');

  perform test_as('00000000-0000-0000-0000-0000000000a2');
  -- Widening is fine.
  update plans set capacity = 6 where id = '00000000-0000-0000-0000-00000000ee05';
  begin
    -- Narrowing past the three people already in is not.
    update plans set capacity = 2 where id = '00000000-0000-0000-0000-00000000ee05';
    assert false, 'capacity was cut below the people already joined';
  exception when check_violation then null; end;
  raise notice 'ok  editing cannot squeeze people out of a plan';
end $$;

-- ── 10. reliability events are readable but never writable ──────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b2');
  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-0000000000c2';
  assert n = 0, 'one user can read another''s reliability history';

  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-0000000000b2';
  assert n > 0, 'a user cannot see their own history';

  begin
    insert into reliability_events (user_id, kind)
    values ('00000000-0000-0000-0000-0000000000b2', 'attended');
    assert false, 'a user manufactured their own attendance';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  reliability history is read-only and private';
end $$;

rollback;
