-- Push subscriptions: a URL that identifies one browser on one device, which
-- is why nobody but its owner may read it and why the functions that reach
-- past that are scoped to a plan rather than to a person.

create or replace function test_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end;
$$;

begin;

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000009' || lpad(i::text,2,'0'))::uuid, 'p9_' || i || '@test.invalid'
  from generate_series(1, 5) i;
insert into profiles (id, display_name, birth_year, distrito)
select ('00000000-0000-0000-0000-0000000009' || lpad(i::text,2,'0'))::uuid, 'P' || i, 1990, 'Centro'
  from generate_series(1, 5) i;
insert into user_sports (user_id, sport, level_norm)
select ('00000000-0000-0000-0000-0000000009' || lpad(i::text,2,'0'))::uuid, 'running', 5
  from generate_series(1, 5) i;

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000009f0', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);

-- P1 hosts. Capacity 2, so P4 lands on the waitlist behind P2 and P3.
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id) values
  ('00000000-0000-0000-0000-0000000009a0', '00000000-0000-0000-0000-000000000901',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 2,
   '00000000-0000-0000-0000-0000000009f0');

insert into push_subscriptions (user_id, endpoint, p256dh, auth)
select ('00000000-0000-0000-0000-0000000009' || lpad(i::text,2,'0'))::uuid,
       'https://push.test.invalid/' || i, 'p256dh-' || i, 'auth-' || i
  from generate_series(1, 5) i;

set role authenticated;

-- ── 1. a subscription is yours alone ────────────────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000901');
  select count(*) into n from push_subscriptions;
  assert n = 1, 'a subscription other than your own is readable: ' || n;

  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-0000-0000-000000000902', 'https://push.test.invalid/x', 'a', 'b');
    assert false, 'a subscription was written on someone else''s behalf';
  exception when insufficient_privilege then null; end;

  delete from push_subscriptions where endpoint = 'https://push.test.invalid/2';
  select count(*) into n from push_subscriptions where endpoint = 'https://push.test.invalid/2';
  -- Not deleted: RLS made the row invisible to the delete, which is the point.
  reset role;
  select count(*) into n from push_subscriptions where endpoint = 'https://push.test.invalid/2';
  assert n = 1, 'someone deleted another person''s subscription';
  set role authenticated;
  raise notice 'ok  a push subscription is readable and writable only by its owner';
end $$;

-- ── 2. reaching the roster, and only the roster ─────────────────────────────
do $$
declare n int; v_audience uuid[];
begin
  perform test_as('00000000-0000-0000-0000-000000000902');
  perform join_plan('00000000-0000-0000-0000-0000000009a0');
  perform test_as('00000000-0000-0000-0000-000000000903');
  perform join_plan('00000000-0000-0000-0000-0000000009a0');
  perform test_as('00000000-0000-0000-0000-000000000904');
  perform join_plan('00000000-0000-0000-0000-0000000009a0');  -- waitlist

  -- The host may reach the people on their plan.
  perform test_as('00000000-0000-0000-0000-000000000901');
  select array_agg(u order by u) into v_audience
    from plan_audience('00000000-0000-0000-0000-0000000009a0') u;
  assert array_length(v_audience, 1) = 4, 'the plan audience is the wrong size';

  select count(*) into n from push_targets_for_plan(
    '00000000-0000-0000-0000-0000000009a0', v_audience);
  assert n = 3, 'the host reached ' || n || ' subscriptions instead of 3';

  -- P5 is not on this plan and reaches nothing, even naming real users.
  perform test_as('00000000-0000-0000-0000-000000000905');
  select count(*) into n from push_targets_for_plan(
    '00000000-0000-0000-0000-0000000009a0', v_audience);
  assert n = 0, 'someone outside the plan reached its subscriptions';
  select count(*) into n from plan_audience('00000000-0000-0000-0000-0000000009a0') u;
  assert n = 0, 'someone outside the plan read its roster';
  raise notice 'ok  push targets are a plan you are in, never a user id you name';
end $$;

-- ── 3. a block is a block here too ──────────────────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000903');
  perform block_user('00000000-0000-0000-0000-000000000901');

  perform test_as('00000000-0000-0000-0000-000000000901');
  select count(*) into n from push_targets_for_plan(
    '00000000-0000-0000-0000-0000000009a0',
    array['00000000-0000-0000-0000-000000000903'::uuid]);
  assert n = 0, 'a blocked person was still reachable by notification';
  raise notice 'ok  blocking stops the notifications too';
end $$;

-- ── 4. the promotion notifies once, and only the people entitled to send it ─
do $$
declare n int; v_promoted uuid;
begin
  -- P2 leaves; P4 comes off the waitlist.
  perform test_as('00000000-0000-0000-0000-000000000902');
  perform leave_plan('00000000-0000-0000-0000-0000000009a0');

  reset role;
  select user_id into v_promoted from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000009a0' and promoted_at is not null;
  assert v_promoted = '00000000-0000-0000-0000-000000000904',
    'the promotion was not marked for the person promoted';
  set role authenticated;

  -- A stranger cannot claim it.
  perform test_as('00000000-0000-0000-0000-000000000905');
  select count(*) into n from notify_promotion('00000000-0000-0000-0000-0000000009a0');
  assert n = 0, 'someone outside the plan claimed its promotion';

  -- The person who just left can, which is the whole point: they caused it.
  perform test_as('00000000-0000-0000-0000-000000000902');
  select count(*) into n from notify_promotion('00000000-0000-0000-0000-0000000009a0');
  assert n = 1, 'the leaver could not send the promotion they caused: ' || n;

  -- And exactly once, however many people ask.
  select count(*) into n from notify_promotion('00000000-0000-0000-0000-0000000009a0');
  assert n = 0, 'the same promotion was sent twice';
  perform test_as('00000000-0000-0000-0000-000000000901');
  select count(*) into n from notify_promotion('00000000-0000-0000-0000-0000000009a0');
  assert n = 0, 'the same promotion was sent twice, to a second caller';
  raise notice 'ok  a promotion is announced once, by someone who was there';
end $$;

-- ── 5. a dead endpoint can be retired by whoever found it dead ──────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000901');
  perform forget_push_endpoint('https://push.test.invalid/4');
  reset role;
  select count(*) into n from push_subscriptions
   where endpoint = 'https://push.test.invalid/4';
  assert n = 0, 'a dead endpoint could not be retired';
  set role authenticated;

  perform test_as(null);
  perform forget_push_endpoint('https://push.test.invalid/5');
  reset role;
  select count(*) into n from push_subscriptions
   where endpoint = 'https://push.test.invalid/5';
  assert n = 1, 'a signed-out caller deleted a subscription';
  raise notice 'ok  a dead endpoint is retired by the sender, not by anyone';
end $$;

reset role;
rollback;
