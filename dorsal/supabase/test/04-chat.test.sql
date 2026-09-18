-- The group chat. 01-PRD §Trust and safety: chat exists only inside a plan you
-- joined, and there is no way to message a stranger. That is a claim about a
-- policy, so this is where it is checked.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a4', 'anfitriona@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b4', 'bruno@test.invalid'),
  ('00000000-0000-0000-0000-0000000000c4', 'carla@test.invalid'),
  ('00000000-0000-0000-0000-0000000000d4', 'desconocido@test.invalid'),
  ('00000000-0000-0000-0000-0000000000e4', 'elena@test.invalid');

insert into profiles (id, display_name, birth_year, distrito) values
  ('00000000-0000-0000-0000-0000000000a4', 'Ana',    1995, 'Chamberí'),
  ('00000000-0000-0000-0000-0000000000b4', 'Bruno',  1993, 'Centro'),
  ('00000000-0000-0000-0000-0000000000c4', 'Carla',  1997, 'Salamanca'),
  ('00000000-0000-0000-0000-0000000000d4', 'Diego',  1990, 'Retiro'),
  ('00000000-0000-0000-0000-0000000000e4', 'Elena',  1994, 'Tetuán');

insert into user_sports (user_id, sport, level_norm)
select id, 'running', 5 from profiles where id in (
  '00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000c4',
  '00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000e4');

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000000f4', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);

insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a4',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 6,
   '00000000-0000-0000-0000-0000000000f4'),
  -- The one that will be pushed into the past to test archiving.
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a4',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 6,
   '00000000-0000-0000-0000-0000000000f4');

set role authenticated;
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000000b4');
  perform join_plan('00000000-0000-0000-0000-0000000000c1');
  perform join_plan('00000000-0000-0000-0000-0000000000c2');
  perform test_as('00000000-0000-0000-0000-0000000000c4');
  perform join_plan('00000000-0000-0000-0000-0000000000c1');
  perform test_as('00000000-0000-0000-0000-0000000000e4');
  perform join_plan('00000000-0000-0000-0000-0000000000c1');
end $$;
reset role;

-- Both plans are now in the past: c2 far enough that its chat has closed.
-- created_at moves with starts_at, because plans.future_start compares the two
-- columns rather than either against now().
update plans set created_at = now() - interval '10 days', starts_at = now() - interval '5 days'
 where id = '00000000-0000-0000-0000-0000000000c2';

set role authenticated;

-- ── 1. a non-participant cannot read a single message ───────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b4');
  insert into messages (plan_id, user_id, body)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b4',
          'Quedamos en la puerta de Alcalá, no en el estanque.');

  perform test_as('00000000-0000-0000-0000-0000000000d4');   -- never joined
  select count(*) into n from messages;
  assert n = 0, 'a non-participant read ' || n || ' messages';
  select count(*) into n from messages where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert n = 0, 'a non-participant read the thread by plan id';
  raise notice 'ok  a non-participant cannot read a single message';
end $$;

-- ── 2. and cannot write into it either ──────────────────────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000000d4');
  begin
    insert into messages (plan_id, user_id, body)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 'hola');
    assert false, 'a stranger wrote into a plan chat';
  exception when insufficient_privilege then null; end;

  -- Nor by forging the author.
  perform test_as('00000000-0000-0000-0000-0000000000b4');
  begin
    insert into messages (plan_id, user_id, body)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 'hola');
    assert false, 'a participant posted as someone else';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  only participants write, and only as themselves';
end $$;

-- ── 3. the host is in their own chat ────────────────────────────────────────
-- The host has no plan_participants row — join_plan() refuses them — so a
-- membership-only predicate would lock them out of the plan they organise.
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000a4');
  select count(*) into n from messages where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert n = 1, 'the host cannot read their own plan chat';
  insert into messages (plan_id, user_id, body)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a4',
          'Confirmado. Llevo dorsales de repuesto.');
  raise notice 'ok  the host can read and write their own chat';
end $$;

-- ── 4. leaving takes the chat with it ───────────────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000e4');
  select count(*) into n from messages where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert n > 0, 'a participant cannot read the chat they are in';

  perform leave_plan('00000000-0000-0000-0000-0000000000c1');
  select count(*) into n from messages where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert n = 0, 'someone who left can still read the chat';

  begin
    insert into messages (plan_id, user_id, body)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e4', 'sigo aquí');
    assert false, 'someone who left can still write';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  leaving the plan leaves the conversation';
end $$;

-- ── 5. blocked people disappear from the thread ─────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000c4');
  select count(*) into n from messages where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert n = 2, 'expected two messages before the block, saw ' || n;

  insert into blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b4');

  select count(*) into n from messages
   where plan_id = '00000000-0000-0000-0000-0000000000c1'
     and user_id = '00000000-0000-0000-0000-0000000000b4';
  assert n = 0, 'a blocked person''s messages are still visible';

  -- And symmetrically, from the other side.
  perform test_as('00000000-0000-0000-0000-0000000000b4');
  select count(*) into n from messages
   where plan_id = '00000000-0000-0000-0000-0000000000c1'
     and user_id = '00000000-0000-0000-0000-0000000000c4';
  assert n = 0, 'the block is not symmetric in the chat';
  raise notice 'ok  blocked pairs do not see each other in the thread';
end $$;

-- ── 6. the chat closes 48h after the plan ends ──────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000b4');
  assert not chat_is_open('00000000-0000-0000-0000-0000000000c2'), 'an old chat is still open';
  assert chat_is_open('00000000-0000-0000-0000-0000000000c1'), 'an upcoming chat is closed';

  begin
    insert into messages (plan_id, user_id, body)
    values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b4', 'tarde');
    assert false, 'wrote into a chat that closed two days ago';
  exception when insufficient_privilege then null; end;

  -- Read-only, not gone: what the group agreed is worth keeping.
  select count(*) into n from messages where plan_id = '00000000-0000-0000-0000-0000000000c2';
  assert n = 0, 'unexpected messages in the archived plan';
  raise notice 'ok  the chat closes 48h after the plan ends, and stays readable';
end $$;

-- ── 7. pinning is the host's, and there is only ever one ────────────────────
do $$
declare v_a uuid; v_b uuid; n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000000a4');
  select id into v_a from messages
   where plan_id = '00000000-0000-0000-0000-0000000000c1'
     and user_id = '00000000-0000-0000-0000-0000000000a4' limit 1;
  select id into v_b from messages
   where plan_id = '00000000-0000-0000-0000-0000000000c1'
     and user_id = '00000000-0000-0000-0000-0000000000b4' limit 1;

  perform pin_message(v_a);
  select count(*) into n from messages
   where plan_id = '00000000-0000-0000-0000-0000000000c1' and is_pinned;
  assert n = 1, 'expected one pinned message, saw ' || n;

  -- Pinning another replaces it rather than adding a second answer.
  perform pin_message(v_b);
  select count(*) into n from messages
   where plan_id = '00000000-0000-0000-0000-0000000000c1' and is_pinned;
  assert n = 1, 'two messages pinned at once: ' || n;

  perform test_as('00000000-0000-0000-0000-0000000000c4');
  begin
    perform pin_message(v_b);
    assert false, 'a participant pinned a message';
  exception when others then assert sqlerrm = 'not_host', 'wrong error: ' || sqlerrm; end;

  -- And not by editing the row directly: there is no UPDATE policy at all.
  update messages set is_pinned = true where id = v_a;
  get diagnostics n = row_count;
  assert n = 0, 'is_pinned was changed by a direct update';
  raise notice 'ok  pinning is the host''s, and there is only ever one pin';
end $$;

-- ── 8. messages cannot be edited, and only briefly deleted ──────────────────
do $$
declare n int; v_id uuid;
begin
  perform test_as('00000000-0000-0000-0000-0000000000c4');
  insert into messages (plan_id, user_id, body)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c4', 'voy')
  returning id into v_id;

  update messages set body = 'no voy' where id = v_id;
  get diagnostics n = row_count;
  assert n = 0, 'a message was edited after the fact';

  delete from messages where id = v_id;
  get diagnostics n = row_count;
  assert n = 1, 'could not delete own message within five minutes';

  -- Someone else's, never.
  delete from messages where user_id = '00000000-0000-0000-0000-0000000000a4';
  get diagnostics n = row_count;
  assert n = 0, 'deleted someone else''s message';
  raise notice 'ok  no edits, own deletes only, and only for five minutes';
end $$;

-- ── 9. unread counts ────────────────────────────────────────────────────────
do $$
declare v_unread int;
begin
  -- Carla blocked Bruno above, so only the host's message counts for her.
  perform test_as('00000000-0000-0000-0000-0000000000c4');
  select unread into v_unread from my_unread_counts()
   where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert v_unread >= 1, 'nothing unread when there should be: ' || coalesce(v_unread, -1);

  perform mark_chat_read('00000000-0000-0000-0000-0000000000c1');
  select unread into v_unread from my_unread_counts()
   where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert v_unread = 0, 'still unread after marking read: ' || v_unread;

  -- Your own message never comes back at you as unread.
  insert into messages (plan_id, user_id, body)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c4', 'ok');
  select unread into v_unread from my_unread_counts()
   where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert v_unread = 0, 'own message counted as unread: ' || v_unread;

  -- The host gets counts too, without a participant row.
  perform test_as('00000000-0000-0000-0000-0000000000a4');
  select unread into v_unread from my_unread_counts()
   where plan_id = '00000000-0000-0000-0000-0000000000c1';
  assert v_unread is not null, 'the host has no unread count for their own plan';
  raise notice 'ok  unread counts, for participants and hosts alike';
end $$;

-- ── 10. a stranger cannot mark someone else's chat read ─────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000000d4');
  begin
    perform mark_chat_read('00000000-0000-0000-0000-0000000000c1');
    assert false, 'a stranger marked a chat read';
  exception when others then assert sqlerrm = 'not_in_plan', 'wrong error: ' || sqlerrm; end;
  raise notice 'ok  chat reads are only for people in the chat';
end $$;

rollback;
