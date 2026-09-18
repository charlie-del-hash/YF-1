-- Which columns the API may write.
--
-- Every own-row policy says whose row may be written and nothing about which
-- columns, so until 0014 `update profiles set is_admin = true where id =
-- auth.uid()` was one REST call with the publishable key. These assertions ask
-- the catalogue which columns the API roles hold INSERT or UPDATE on, and then
-- try the writes anyway: the catalogue says what is granted, the attempt says
-- what happens — and the app's own write shapes have to keep working.

create or replace function test_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end;
$$;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'a01@test.invalid'),   -- hosts the plan
  ('00000000-0000-0000-0000-000000000a02', 'a02@test.invalid'),   -- joins it
  ('00000000-0000-0000-0000-000000000a03', 'a03@test.invalid');   -- signed up, no profile yet
insert into profiles (id, display_name, birth_year, distrito) values
  ('00000000-0000-0000-0000-000000000a01', 'Hugo', 1990, 'Retiro'),
  ('00000000-0000-0000-0000-000000000a02', 'Inés', 1992, 'Centro');
insert into user_sports (user_id, sport, level_norm) values
  ('00000000-0000-0000-0000-000000000a01', 'running', 5),
  ('00000000-0000-0000-0000-000000000a02', 'running', 5);
insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-000000000af1', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id) values
  ('00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000a01',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 4,
   '00000000-0000-0000-0000-000000000af1');

-- ── 1. the columns only the database and the moderator decide ───────────────
-- has_column_privilege() answers true for a table-level grant as well as a
-- column-level one, which is the point: neither may exist.
do $$
declare v_open text[];
begin
  select coalesce(array_agg(t.tbl || '.' || t.col || ' ' || t.priv order by 1), '{}')
    into v_open
    from (values
      ('profiles', 'is_admin', 'UPDATE'),          ('profiles', 'is_admin', 'INSERT'),
      ('profiles', 'is_suspended', 'UPDATE'),      ('profiles', 'is_suspended', 'INSERT'),
      ('profiles', 'is_seed', 'UPDATE'),           ('profiles', 'is_seed', 'INSERT'),
      ('profiles', 'dorsal_number', 'UPDATE'),     ('profiles', 'dorsal_number', 'INSERT'),
      ('profiles', 'created_at', 'UPDATE'),
      ('plans', 'joined_count', 'UPDATE'),         ('plans', 'joined_count', 'INSERT'),
      ('plans', 'status', 'UPDATE'),               ('plans', 'status', 'INSERT'),
      ('plans', 'cancelled_reason', 'UPDATE'),     ('plans', 'cancelled_reason', 'INSERT'),
      ('plans', 'filled_at', 'UPDATE'),            ('plans', 'filled_at', 'INSERT'),
      ('plans', 'series_id', 'UPDATE'),            ('plans', 'series_id', 'INSERT'),
      ('plans', 'is_seed', 'UPDATE'),              ('plans', 'is_seed', 'INSERT'),
      ('plans', 'created_at', 'UPDATE'),           ('plans', 'created_at', 'INSERT'),
      ('venues', 'verified', 'UPDATE'),            ('venues', 'verified', 'INSERT'),
      ('venues', 'is_seed', 'UPDATE'),             ('venues', 'is_seed', 'INSERT'),
      ('messages', 'is_pinned', 'INSERT'),         ('messages', 'is_pinned', 'UPDATE'),
      ('messages', 'created_at', 'INSERT'),        ('messages', 'body', 'UPDATE'),
      ('reports', 'status', 'INSERT'),             ('reports', 'resolution', 'INSERT'),
      ('reports', 'resolved_at', 'INSERT'),        ('reports', 'resolved_by', 'INSERT'),
      ('plan_participants', 'status', 'INSERT'),   ('plan_participants', 'status', 'UPDATE'),
      ('plan_participants', 'host_marked', 'UPDATE'), ('plan_participants', 'self_marked', 'UPDATE'),
      ('plan_participants', 'settled_at', 'UPDATE'),  ('plan_participants', 'promoted_at', 'UPDATE'),
      ('reliability_events', 'kind', 'INSERT'),    ('reliability_events', 'kind', 'UPDATE'),
      ('moderation_actions', 'action', 'INSERT'),  ('moderation_actions', 'reason', 'UPDATE'),
      ('verifications', 'status', 'INSERT'),       ('verifications', 'reviewed_by', 'INSERT')
    ) as t(tbl, col, priv)
   where has_column_privilege('authenticated', ('public.' || t.tbl)::regclass, t.col, t.priv)
      or has_column_privilege('anon',          ('public.' || t.tbl)::regclass, t.col, t.priv);
  assert v_open = '{}', 'the API can write: ' || array_to_string(v_open, ', ');

  assert not has_table_privilege('authenticated', 'plan_participants', 'DELETE'),
    'the API can delete membership rows';
  assert not has_table_privilege('authenticated', 'reliability_events', 'DELETE'),
    'the API can delete reliability history';
  raise notice 'ok  no API role may write a column that only the database decides';
end $$;

-- ── 2. and every column the app writes is still open ────────────────────────
-- The other half of a column grant: taking too much away is a broken form,
-- found by the first person to save their profile after the deploy.
do $$
declare v_closed text[];
begin
  select coalesce(array_agg(t.tbl || '.' || t.col || ' ' || t.priv order by 1), '{}')
    into v_closed
    from (values
      ('profiles', 'id', 'INSERT'),          ('profiles', 'display_name', 'INSERT'),
      ('profiles', 'photo_url', 'UPDATE'),   ('profiles', 'bio', 'UPDATE'),
      ('profiles', 'distrito', 'UPDATE'),    ('profiles', 'travel_km', 'UPDATE'),
      ('plans', 'host_id', 'INSERT'),        ('plans', 'starts_at', 'INSERT'),
      ('plans', 'capacity', 'UPDATE'),       ('plans', 'meeting_note', 'UPDATE'),
      ('plans', 'recurring_rule', 'UPDATE'), ('plans', 'level_display', 'INSERT'),
      ('venues', 'name', 'INSERT'),          ('venues', 'lat', 'INSERT'),
      ('venues', 'created_by', 'INSERT'),    ('venues', 'is_public', 'INSERT'),
      ('messages', 'body', 'INSERT'),        ('messages', 'plan_id', 'INSERT'),
      ('reports', 'reason', 'INSERT'),       ('reports', 'detail', 'INSERT'),
      ('reports', 'subject_message', 'INSERT'),
      ('swipes', 'direction', 'INSERT'),     ('swipes', 'direction', 'UPDATE'),
      ('push_subscriptions', 'auth', 'INSERT'), ('push_subscriptions', 'auth', 'UPDATE'),
      ('chat_reads', 'last_read_at', 'UPDATE'), ('blocks', 'blocked_id', 'INSERT'),
      ('user_sports', 'level_norm', 'UPDATE')
    ) as t(tbl, col, priv)
   where not has_column_privilege('authenticated', ('public.' || t.tbl)::regclass, t.col, t.priv);
  assert v_closed = '{}', 'the app can no longer write: ' || array_to_string(v_closed, ', ');
  raise notice 'ok  every column the app writes is still writable';
end $$;

set role authenticated;

-- ── 3. nobody appoints or pardons themselves ────────────────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000a01');
  begin
    update profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000a01';
    assert false, 'a person made themselves a moderator';
  exception when insufficient_privilege then null; end;
  begin
    update profiles set is_suspended = false where id = '00000000-0000-0000-0000-000000000a01';
    assert false, 'a person lifted their own suspension';
  exception when insufficient_privilege then null; end;

  -- Signed up, not yet onboarded: the first write is an INSERT, and it may not
  -- carry the flag either.
  perform test_as('00000000-0000-0000-0000-000000000a03');
  begin
    insert into profiles (id, display_name, birth_year, distrito, is_admin)
    values ('00000000-0000-0000-0000-000000000a03', 'Jon', 1990, 'Centro', true);
    assert false, 'a profile was created already a moderator';
  exception when insufficient_privilege then null; end;

  -- What the app actually writes still works.
  perform test_as('00000000-0000-0000-0000-000000000a01');
  update profiles
     set bio = 'Corro por Retiro.', photo_url = '00000000-0000-0000-0000-000000000a01/perfil'
   where id = '00000000-0000-0000-0000-000000000a01';
  get diagnostics n = row_count;
  assert n = 1, 'a person cannot edit their own profile any more';
  raise notice 'ok  is_admin and is_suspended are not the person''s to write';
end $$;

-- ── 4. the roster is written by functions and by nobody else ────────────────
do $$
declare n int; v_status join_status;
begin
  perform test_as('00000000-0000-0000-0000-000000000a02');
  perform join_plan('00000000-0000-0000-0000-000000000ae1');

  begin
    update plan_participants set status = 'attended'
     where plan_id = '00000000-0000-0000-0000-000000000ae1'
       and user_id = '00000000-0000-0000-0000-000000000a02';
    assert false, 'a participant marked themselves attended';
  exception when insufficient_privilege then null; end;
  begin
    update plan_participants set host_marked = true, self_marked = true
     where plan_id = '00000000-0000-0000-0000-000000000ae1'
       and user_id = '00000000-0000-0000-0000-000000000a02';
    assert false, 'a participant answered the roster for the host';
  exception when insufficient_privilege then null; end;
  begin
    delete from plan_participants
     where plan_id = '00000000-0000-0000-0000-000000000ae1'
       and user_id = '00000000-0000-0000-0000-000000000a02';
    assert false, 'a participant deleted their own membership row';
  exception when insufficient_privilege then null; end;

  -- The functions still work, and the counter still follows them.
  perform leave_plan('00000000-0000-0000-0000-000000000ae1');
  select status into v_status from plan_participants
   where plan_id = '00000000-0000-0000-0000-000000000ae1'
     and user_id = '00000000-0000-0000-0000-000000000a02';
  assert v_status = 'left', 'leave_plan() stopped working: ' || v_status;
  select joined_count into n from plans where id = '00000000-0000-0000-0000-000000000ae1';
  assert n = 0, 'joined_count did not follow the leave: ' || n;
  raise notice 'ok  the roster is written by functions and by nobody else';
end $$;

-- ── 5. a host edits the plan, never its counters or its status ──────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000a01');
  begin
    update plans set joined_count = 4 where id = '00000000-0000-0000-0000-000000000ae1';
    assert false, 'the host rewrote the counter';
  exception when insufficient_privilege then null; end;
  begin
    update plans set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000ae1';
    assert false, 'the host cancelled with no reason, past cancel_plan()';
  exception when insufficient_privilege then null; end;
  begin
    update plans set is_seed = true, filled_at = now(), created_at = now() - interval '30 days'
     where id = '00000000-0000-0000-0000-000000000ae1';
    assert false, 'the host rewrote the columns the metrics are computed from';
  exception when insufficient_privilege then null; end;
  begin
    insert into plans (host_id, sport, starts_at, distrito, level_min, level_max,
                       level_display, capacity, venue_id, is_seed)
    values ('00000000-0000-0000-0000-000000000a01', 'running', now() + interval '2 days',
            'Retiro', 4, 6, '8 km', 4, '00000000-0000-0000-0000-000000000af1', true);
    assert false, 'a plan was created as an example';
  exception when insufficient_privilege then null; end;

  -- The edit form's own shape: every column savePlan() sends.
  update plans
     set host_id = '00000000-0000-0000-0000-000000000a01', sport = 'running',
         starts_at = now() + interval '4 days', duration_min = 75,
         venue_id = '00000000-0000-0000-0000-000000000af1', third_half_venue_id = null,
         distrito = 'Retiro', level_min = 4, level_max = 7, level_display = '8 km',
         capacity = 5, third_half = 'cafe', audience = 'todos', min_plans_required = 0,
         recurring_rule = 'weekly', meeting_note = 'Salimos puntuales.'
   where id = '00000000-0000-0000-0000-000000000ae1';
  get diagnostics n = row_count;
  assert n = 1, 'the host cannot edit their own plan any more';
  raise notice 'ok  a host edits the plan, never its counters or its status';
end $$;

-- ── 6. venues start unverified, messages unpinned and undated, reports open ─
do $$
declare v_id uuid; v_verified boolean; v_seed boolean; v_status report_status;
begin
  perform test_as('00000000-0000-0000-0000-000000000a02');
  begin
    insert into venues (name, kind, distrito, lat, lng, verified, created_by)
    values ('Mi portal', 'parque', 'Centro', 40.4, -3.7, true, '00000000-0000-0000-0000-000000000a02');
    assert false, 'a person confirmed their own pin';
  exception when insufficient_privilege then null; end;
  -- createVenue()'s own shape.
  insert into venues (name, kind, distrito, lat, lng, is_public, created_by)
  values ('Fuente del parque', 'otro', 'Centro', 40.4, -3.7, true, '00000000-0000-0000-0000-000000000a02')
  returning verified, is_seed into v_verified, v_seed;
  assert not v_verified and not v_seed, 'a pinned venue did not start unverified';

  perform join_plan('00000000-0000-0000-0000-000000000ae1');
  begin
    insert into messages (plan_id, user_id, body, is_pinned)
    values ('00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000a02', 'en mi casa', true);
    assert false, 'a message was pinned by its author';
  exception when insufficient_privilege then null; end;
  begin
    insert into messages (plan_id, user_id, body, created_at)
    values ('00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000a02', 'ayer', now() - interval '1 day');
    assert false, 'a message was backdated';
  exception when insufficient_privilege then null; end;
  -- sendMessage()'s own shape.
  insert into messages (plan_id, user_id, body)
  values ('00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000a02', 'voy')
  returning id into v_id;
  assert v_id is not null, 'a participant cannot write to the chat any more';

  begin
    insert into reports (reporter_id, subject_user, reason, status, resolution, resolved_by)
    values ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a01',
            'spam', 'actioned', 'Suspendido.', '00000000-0000-0000-0000-000000000a01');
    assert false, 'a report was filed already resolved';
  exception when insufficient_privilege then null; end;
  -- submitReport()'s own shape.
  insert into reports (reporter_id, subject_user, subject_plan, subject_message, reason, detail)
  values ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a01',
          null, null, 'spam', 'Publicidad.')
  returning status into v_status;
  assert v_status = 'open', 'a fresh report is not open: ' || v_status;
  raise notice 'ok  venues start unverified, messages unpinned and undated, reports open';
end $$;

-- ── 7. the counts trigger writes as the owner ───────────────────────────────
-- A trigger that runs as whoever fired it updates `plans` under that person's
-- policies, and a participant is not the host. That is how a roster came to
-- say four while the card said three.
do $$ begin
  reset role;
  assert (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'sync_plan_counts'),
    'sync_plan_counts() runs as whoever fired it';
  raise notice 'ok  the counts trigger writes as the owner, whoever caused it';
end $$;

reset role;
rollback;
