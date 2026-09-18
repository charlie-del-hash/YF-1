-- Trust and safety. 01-PRD §Trust and safety and 05-RGPD §5.
-- These are the assertions behind "I could hand this to a stranger".

begin;

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000006' || lpad(i::text,2,'0'))::uuid, 'p6_' || i || '@test.invalid'
  from generate_series(1, 6) i;
insert into profiles (id, display_name, birth_year, distrito)
select ('00000000-0000-0000-0000-0000000006' || lpad(i::text,2,'0'))::uuid,
       'S' || i, 1995, 'Centro' from generate_series(1, 6) i;
insert into user_sports (user_id, sport, level_norm)
select ('00000000-0000-0000-0000-0000000006' || lpad(i::text,2,'0'))::uuid, 'running', 5
  from generate_series(1, 6) i;

-- S6 moderates.
update profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000606';

insert into venues (id, name, kind, distrito, lat, lng, verified) values
  ('00000000-0000-0000-0000-0000000006f0', 'Retiro', 'parque', 'Retiro', 40.42, -3.68, true);
insert into plans (id, host_id, sport, starts_at, distrito, level_min, level_max,
                   level_display, capacity, venue_id) values
  ('00000000-0000-0000-0000-0000000006a0', '00000000-0000-0000-0000-000000000601',
   'running', now() + interval '3 days', 'Retiro', 4, 6, '8 km', 6,
   '00000000-0000-0000-0000-0000000006f0');

set role authenticated;
do $$ begin
  perform test_as('00000000-0000-0000-0000-000000000602'); perform join_plan('00000000-0000-0000-0000-0000000006a0');
  perform test_as('00000000-0000-0000-0000-000000000603'); perform join_plan('00000000-0000-0000-0000-0000000006a0');
  perform test_as('00000000-0000-0000-0000-000000000604'); perform join_plan('00000000-0000-0000-0000-0000000006a0');
end $$;

-- ── 1. a report is private to its author and the queue ──────────────────────
do $$
declare v_id uuid; n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000602');
  insert into reports (reporter_id, subject_user, reason, detail)
  values ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000603',
          'acoso', 'Mensajes fuera de lugar.')
  returning id into v_id;

  select count(*) into n from reports where id = v_id;
  assert n = 1, 'the reporter cannot see their own report';

  -- The person reported learns nothing.
  perform test_as('00000000-0000-0000-0000-000000000603');
  select count(*) into n from reports;
  assert n = 0, 'the reported person can read reports about them';

  -- Nor can an unrelated user.
  perform test_as('00000000-0000-0000-0000-000000000604');
  select count(*) into n from reports;
  assert n = 0, 'a bystander can read reports';

  perform test_as('00000000-0000-0000-0000-000000000606');
  select count(*) into n from reports where id = v_id;
  assert n = 1, 'the queue cannot see the report';
  raise notice 'ok  a report is visible to its author and to moderators, nobody else';
end $$;

-- ── 2. reports cannot be filed as somebody else, or resolved by anybody ─────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000604');
  begin
    insert into reports (reporter_id, subject_user, reason)
    values ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000603', 'spam');
    assert false, 'a report was filed in someone else''s name';
  exception when insufficient_privilege then null; end;

  update reports set status = 'dismissed';
  get diagnostics n = row_count;
  assert n = 0, 'a non-moderator resolved a report';
  raise notice 'ok  reports are filed as yourself and resolved only by the queue';
end $$;

-- ── 3. moderation needs an admin, a reason, and leaves a trail ──────────────
do $$
declare n int; v_reason text;
begin
  perform test_as('00000000-0000-0000-0000-000000000604');
  begin
    perform moderate('suspend_user', 'porque sí', '00000000-0000-0000-0000-000000000603');
    assert false, 'a normal user suspended someone';
  exception when others then assert sqlerrm = 'not_admin', 'wrong error: ' || sqlerrm; end;

  perform test_as('00000000-0000-0000-0000-000000000606');
  begin
    perform moderate('suspend_user', '   ', '00000000-0000-0000-0000-000000000603');
    assert false, 'a suspension went through with no reason';
  exception when others then assert sqlerrm = 'reason_required', 'wrong error: ' || sqlerrm; end;

  perform moderate('suspend_user', 'Acoso confirmado en dos planes.',
                   '00000000-0000-0000-0000-000000000603');
  select count(*), max(reason) into n, v_reason from moderation_actions
   where action = 'suspend_user' and subject_user = '00000000-0000-0000-0000-000000000603';
  assert n = 1, 'the moderation action was not logged';
  assert v_reason = 'Acoso confirmado en dos planes.', 'the reason was not logged';
  raise notice 'ok  moderation is admin-only, needs a reason, and is logged';
end $$;

-- ── 4. a suspended account disappears from the product ──────────────────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000604');
  select count(*) into n from public_profiles where id = '00000000-0000-0000-0000-000000000603';
  assert n = 0, 'a suspended account is still on public_profiles';

  perform test_as('00000000-0000-0000-0000-000000000603');
  begin
    perform join_plan('00000000-0000-0000-0000-0000000006a0');
    assert false, 'a suspended account joined a plan';
  exception when others then assert sqlerrm in ('suspended','joined'), 'wrong error: ' || sqlerrm; end;
  raise notice 'ok  a suspended account cannot be seen or join anything';
end $$;

-- ── 5. the post-plan check is private, and a "no" reaches a human ───────────
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000604');
  perform record_safety_check('00000000-0000-0000-0000-0000000006a0', false, 'Me incomodó el ambiente.');

  select count(*) into n from reports
   where reporter_id = '00000000-0000-0000-0000-000000000604'
     and subject_plan = '00000000-0000-0000-0000-0000000006a0';
  assert n = 1, 'a negative check did not reach the queue: ' || n;

  -- The host never sees it. Not the answer, not the note.
  perform test_as('00000000-0000-0000-0000-000000000601');
  select count(*) into n from safety_checks
   where plan_id = '00000000-0000-0000-0000-0000000006a0';
  assert n = 0, 'the host can read the post-plan checks on their own plan';

  perform test_as('00000000-0000-0000-0000-000000000606');
  select count(*) into n from safety_checks
   where plan_id = '00000000-0000-0000-0000-0000000006a0';
  assert n = 1, 'the queue cannot see the check behind the report';
  raise notice 'ok  the post-plan check is private and a "no" opens a report';
end $$;

-- ── 6. verification: private, reviewed by a person, badge only ──────────────
do $$
declare n int; v_path text; v_verified boolean;
begin
  perform test_as('00000000-0000-0000-0000-000000000602');
  insert into verifications (user_id, kind, selfie_path)
  values ('00000000-0000-0000-0000-000000000602', 'selfie',
          '00000000-0000-0000-0000-000000000602/selfie.jpg');

  perform test_as('00000000-0000-0000-0000-000000000604');
  select count(*) into n from verifications;
  assert n = 0, 'one user can read another''s verification';

  perform test_as('00000000-0000-0000-0000-000000000602');
  select count(*) into n from public_profiles
   where id = '00000000-0000-0000-0000-000000000602' and is_verified;
  assert n = 0, 'a pending verification already shows a badge';

  perform test_as('00000000-0000-0000-0000-000000000606');
  perform moderate('approve_selfie', 'Coincide con la foto del perfil.',
                   '00000000-0000-0000-0000-000000000602');

  select selfie_path into v_path from verifications
   where user_id = '00000000-0000-0000-0000-000000000602' and kind = 'selfie';
  assert v_path is null, 'the selfie was kept after the decision';

  perform test_as('00000000-0000-0000-0000-000000000604');
  select is_verified into v_verified from public_profiles
   where id = '00000000-0000-0000-0000-000000000602';
  assert v_verified, 'the badge did not appear after approval';
  raise notice 'ok  verification is private, decided by a person, and leaves only a badge';
end $$;

-- ── 7. a selfie is readable by its owner and the queue, and nobody else ─────
do $$
declare n int;
begin
  reset role;
  insert into storage.objects (bucket_id, name, owner)
  values ('verificaciones', '00000000-0000-0000-0000-000000000605/selfie.jpg',
          '00000000-0000-0000-0000-000000000605');
  alter table storage.objects enable row level security;
  set role authenticated;

  perform test_as('00000000-0000-0000-0000-000000000604');
  select count(*) into n from storage.objects where bucket_id = 'verificaciones';
  assert n = 0, 'someone else read a verification selfie';

  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('verificaciones', '00000000-0000-0000-0000-000000000605/otra.jpg',
            '00000000-0000-0000-0000-000000000604');
    assert false, 'a selfie was written into someone else''s folder';
  exception when insufficient_privilege then null; end;

  perform test_as('00000000-0000-0000-0000-000000000605');
  select count(*) into n from storage.objects where bucket_id = 'verificaciones';
  assert n = 1, 'the owner cannot read their own selfie';

  perform test_as('00000000-0000-0000-0000-000000000606');
  select count(*) into n from storage.objects where bucket_id = 'verificaciones';
  assert n = 1, 'the queue cannot read the selfie it has to review';
  raise notice 'ok  a selfie is readable by its owner and the queue only';
end $$;

-- ── 8. blocking someone you share a plan with ───────────────────────────────
do $$
declare v_plans uuid[]; v_cost text; n int;
begin
  perform test_as('00000000-0000-0000-0000-000000000604');
  select array_agg(plan_id) into v_plans
    from block_user('00000000-0000-0000-0000-000000000602');
  assert '00000000-0000-0000-0000-0000000006a0' = any(v_plans),
    'blocking did not surface the plan they already share';

  -- Leaving because of it costs nothing.
  v_cost := leave_plan_safety('00000000-0000-0000-0000-0000000006a0');
  assert v_cost = 'safety_left', 'unexpected: ' || v_cost;
  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000604'
     and kind in ('late_cancel','early_cancel');
  assert n = 0, 'leaving because of a block was counted as a falta';

  -- Nobody was removed by anybody else: the blocked person is still in.
  reset role;
  select count(*) into n from plan_participants
   where plan_id = '00000000-0000-0000-0000-0000000006a0'
     and user_id = '00000000-0000-0000-0000-000000000602' and status = 'joined';
  assert n = 1, 'the blocked person was ejected from the plan';
  set role authenticated;
  raise notice 'ok  the blocker leaves for free; nobody is ejected by anyone else';
end $$;

-- ── 9. the safety exit is only for a real block ─────────────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-000000000605');
  perform join_plan('00000000-0000-0000-0000-0000000006a0');
  begin
    perform leave_plan_safety('00000000-0000-0000-0000-0000000006a0');
    assert false, 'the free exit worked without a block';
  exception when others then assert sqlerrm = 'no_block_here', 'wrong error: ' || sqlerrm; end;
  raise notice 'ok  the free exit needs an actual block behind it';
end $$;

-- ── 10. exporting my data ───────────────────────────────────────────────────
do $$
declare v jsonb;
begin
  perform test_as('00000000-0000-0000-0000-000000000602');
  v := export_my_data();
  assert v ? 'perfil' and v ? 'mensajes' and v ? 'asistencia' and v ? 'planes_que_organizo',
    'the export is missing sections: ' || (select string_agg(k, ',') from jsonb_object_keys(v) k);
  assert (v -> 'perfil' ->> 'display_name') = 'S2', 'the export is not mine';
  assert not (v -> 'perfil' ? 'is_admin'), 'the export leaks moderation state';
  assert (v -> 'verificaciones' -> 0 ->> 'status') = 'approved', 'verification status missing';
  raise notice 'ok  the export contains what it should and nothing extra';
end $$;

-- ── 11. deleting my account actually deletes it ─────────────────────────────
do $$
declare n int; v_author uuid; v_status plan_status;
begin
  perform test_as('00000000-0000-0000-0000-000000000601');
  insert into messages (plan_id, user_id, body)
  values ('00000000-0000-0000-0000-0000000006a0', '00000000-0000-0000-0000-000000000601',
          'Nos vemos en la puerta.');

  perform delete_my_account('Ya no vivo en Madrid.');

  reset role;
  select count(*) into n from profiles where id = '00000000-0000-0000-0000-000000000601';
  assert n = 0, 'the profile survived deletion';
  select count(*) into n from auth.users where id = '00000000-0000-0000-0000-000000000601';
  assert n = 0, 'the auth account survived deletion';
  select count(*) into n from reliability_events
   where user_id = '00000000-0000-0000-0000-000000000601';
  assert n = 0, 'reliability history survived deletion';

  -- The words stay, the author does not: the documented exception.
  select user_id into v_author from messages
   where plan_id = '00000000-0000-0000-0000-0000000006a0'
     and body = 'Nos vemos en la puerta.';
  assert v_author is null, 'the message author was not anonymised';

  -- And the plan they hosted is cancelled, not silently gone.
  select status into v_status from plans where id = '00000000-0000-0000-0000-0000000006a0';
  assert v_status = 'cancelled', 'a hosted plan was not cancelled on deletion: ' || v_status;
  set role authenticated;
  raise notice 'ok  deletion deletes, the conversation survives, the plan is cancelled';
end $$;

rollback;
