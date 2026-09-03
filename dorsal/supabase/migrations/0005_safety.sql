-- 0005 — trust and safety. Reports, blocks with teeth, the post-plan check,
-- verification, and the human queue all of it feeds.
--
-- 01-PRD: "The concept lives or dies on whether a woman in Madrid can use it
-- without it feeling like a pickup app." Everything here is a launch blocker in
-- that document, not a phase two.

-- ── who moderates ───────────────────────────────────────────────────────────
alter table profiles add column is_admin boolean not null default false;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
grant execute on function is_admin() to authenticated;

-- ── a deleted account leaves its messages behind, anonymised ────────────────
-- 05-RGPD §5 asks for this decision to be made explicitly: removing someone's
-- messages would tear holes in a conversation other people are relying on to
-- find each other, so the author is dropped and the words stay. The UI renders
-- a null author as "cuenta eliminada".
alter table messages alter column user_id drop not null;
alter table messages drop constraint messages_user_id_fkey;
alter table messages add constraint messages_user_id_fkey
  foreign key (user_id) references profiles on delete set null;

-- ── reports ─────────────────────────────────────────────────────────────────
create type report_reason as enum
  ('acoso','peligro','no_aparecio','perfil_falso','spam','otro');
create type report_status as enum ('open','reviewing','actioned','dismissed');

create table reports (
  id              uuid primary key default gen_random_uuid(),
  -- Kept if the reporter later deletes their account: the report is evidence
  -- about someone else, and the queue still needs to see it.
  reporter_id     uuid references profiles on delete set null,
  subject_user    uuid references profiles on delete cascade,
  subject_plan    uuid references plans on delete set null,
  subject_message uuid references messages on delete set null,
  reason          report_reason not null,
  detail          text check (char_length(detail) <= 1000),
  status          report_status not null default 'open',
  resolution      text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references profiles on delete set null,
  constraint has_a_subject check (
    subject_user is not null or subject_plan is not null or subject_message is not null
  )
);
create index reports_open_idx on reports (created_at desc) where status in ('open','reviewing');

alter table reports enable row level security;

-- The reporter sees their own — 05-RGPD: "We received it and looked at it" is
-- most of what people want — and nobody else does, except a moderator.
create policy reports_read_own on reports for select to authenticated
  using ((select auth.uid()) is not null and (reporter_id = (select auth.uid()) or is_admin()));
create policy reports_insert_own on reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_admin_update on reports for update to authenticated
  using (is_admin()) with check (is_admin());

-- ── the post-plan check ─────────────────────────────────────────────────────
-- 01-PRD: a private one-tap "¿Todo bien?" after a plan, and anything negative
-- routes to a human. It is private in the strong sense: the host never sees it,
-- and nothing about it appears on any roster.
create table safety_checks (
  user_id    uuid not null references profiles on delete cascade,
  plan_id    uuid not null references plans on delete cascade,
  ok         boolean not null,
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);
alter table safety_checks enable row level security;

create policy safety_checks_own on safety_checks for all to authenticated
  using (user_id = (select auth.uid()) or is_admin())
  with check (user_id = (select auth.uid()));

-- A "no" is not a form to fill in afterwards; it opens a report by itself, so
-- that saying something is one tap and a human sees it either way.
create function record_safety_check(p_plan uuid, p_ok boolean, p_note text default null)
  returns void
language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (
    select 1 from plan_participants
     where plan_id = p_plan and user_id = auth.uid() and status in ('joined','attended','no_show')
  ) then
    raise exception 'not_in_plan' using errcode = '42501';
  end if;

  insert into safety_checks (user_id, plan_id, ok, note)
       values (auth.uid(), p_plan, p_ok, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, plan_id) do update set ok = excluded.ok, note = excluded.note;

  if not p_ok then
    select host_id into v_host from plans where id = p_plan;
    insert into reports (reporter_id, subject_plan, subject_user, reason, detail)
         values (auth.uid(), p_plan, v_host, 'otro',
                 coalesce(nullif(btrim(coalesce(p_note, '')), ''),
                          'Respuesta negativa al control posterior al plan.'));
  end if;
end;
$$;
grant execute on function record_safety_check(uuid, boolean, text) to authenticated;

-- ── verification ────────────────────────────────────────────────────────────
-- 05-RGPD §2 is the load-bearing decision here: a human looking at two photos
-- is not biometric processing, and an algorithm comparing them is Article 9
-- special-category data. Nothing in this schema compares anything. The selfie
-- is a path to a private object that is deleted the moment a person decides,
-- and only the badge survives.
create type verification_status as enum ('pending','approved','rejected');

create table verifications (
  user_id       uuid not null references profiles on delete cascade,
  kind          verification not null,
  status        verification_status not null default 'pending',
  selfie_path   text,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references profiles on delete set null,
  reject_reason text,
  primary key (user_id, kind)
);
alter table verifications enable row level security;

create policy verifications_own on verifications for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());
create policy verifications_submit on verifications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy verifications_admin_update on verifications for update to authenticated
  using (is_admin()) with check (is_admin());

create function has_verified_selfie(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from verifications
     where user_id = p_user and kind = 'selfie' and status = 'approved'
  );
$$;
grant execute on function has_verified_selfie(uuid) to authenticated;

-- The badge, and nothing else about the verification, becomes public.
drop view public_profiles;
create view public_profiles with (security_invoker = on) as
  select id, dorsal_number, display_name, photo_url, distrito, bio, created_at,
         has_verified_selfie(id) as is_verified
    from profiles
   where not is_suspended;
grant select on public_profiles to authenticated;

-- ── moderation, logged ──────────────────────────────────────────────────────
-- 05-RGPD: "Log every moderation action with who, what and why."
create table moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references profiles on delete set null,
  action       text not null check (action in
                 ('suspend_user','unsuspend_user','remove_plan','approve_selfie',
                  'reject_selfie','dismiss_report','action_report')),
  subject_user uuid references profiles on delete set null,
  subject_plan uuid references plans on delete set null,
  report_id    uuid references reports on delete set null,
  reason       text not null,
  created_at   timestamptz not null default now()
);
alter table moderation_actions enable row level security;
create policy moderation_admin_read on moderation_actions for select to authenticated
  using (is_admin());

create function moderate(
  p_action text,
  p_reason text,
  p_user   uuid default null,
  p_plan   uuid default null,
  p_report uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  case p_action
    when 'suspend_user'   then update profiles set is_suspended = true  where id = p_user;
    when 'unsuspend_user' then update profiles set is_suspended = false where id = p_user;
    when 'remove_plan'    then
      update plans set status = 'cancelled', cancelled_reason = btrim(p_reason) where id = p_plan;
    when 'approve_selfie' then
      update verifications
         set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), selfie_path = null
       where user_id = p_user and kind = 'selfie';
    when 'reject_selfie'  then
      update verifications
         set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
             reject_reason = btrim(p_reason), selfie_path = null
       where user_id = p_user and kind = 'selfie';
    when 'dismiss_report' then
      update reports set status = 'dismissed', resolution = btrim(p_reason),
                         resolved_at = now(), resolved_by = auth.uid()
       where id = p_report;
    when 'action_report'  then
      update reports set status = 'actioned', resolution = btrim(p_reason),
                         resolved_at = now(), resolved_by = auth.uid()
       where id = p_report;
    else raise exception 'unknown_action' using errcode = '22023';
  end case;

  insert into moderation_actions (admin_id, action, subject_user, subject_plan, report_id, reason)
       values (auth.uid(), p_action, p_user, p_plan, p_report, btrim(p_reason));
end;
$$;
revoke all on function moderate(text, text, uuid, uuid, uuid) from public;
grant execute on function moderate(text, text, uuid, uuid, uuid) to authenticated;

-- ── blocking, and the plan you already share ────────────────────────────────
/*
 * Blocking someone you are about to stand in a park with is the case that
 * matters, and the obvious answers are both wrong. Ejecting the blocked person
 * is weaponisable — block a rival, free a plaza, remove someone from a plan
 * they committed to — and it tells them they were blocked. Doing nothing leaves
 * two people who cannot see each other turning up to the same meeting point.
 *
 * So the blocker decides, for themselves: block_user() returns the upcoming
 * plans they now share, and leaving one of those costs nothing. Nobody is
 * removed by anybody else, and nobody is told they were blocked.
 */
create function block_user(p_user uuid) returns table (plan_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_user = auth.uid() then raise exception 'cannot_block_self' using errcode = '22023'; end if;

  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user)
  on conflict do nothing;

  return query
    select p.id from plans p
     where p.starts_at > now() and p.status <> 'cancelled'
       and (
         -- they host something I am in
         (p.host_id = p_user and exists (
            select 1 from plan_participants pp
             where pp.plan_id = p.id and pp.user_id = auth.uid()
               and pp.status in ('joined','waitlist')))
         -- or we are both in it
         or (exists (select 1 from plan_participants a
                      where a.plan_id = p.id and a.user_id = auth.uid()
                        and a.status in ('joined','waitlist'))
             and exists (select 1 from plan_participants b
                          where b.plan_id = p.id and b.user_id = p_user
                            and b.status in ('joined','waitlist','attended')))
       );
end;
$$;
grant execute on function block_user(uuid) to authenticated;

-- Leaving because of a block is never a falta. 01-PRD, in the copy deck:
-- "sal del plan sin dar explicaciones".
create function leave_plan_safety(p_plan uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_status join_status; v_promoted uuid;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  if not exists (
    select 1 from plans p where p.id = p_plan and (
      is_blocked(v_user, p.host_id)
      or exists (select 1 from plan_participants pp
                  where pp.plan_id = p_plan and is_blocked(v_user, pp.user_id))
    )
  ) then
    raise exception 'no_block_here' using errcode = '42501';
  end if;

  select status into v_status from plan_participants
   where plan_id = p_plan and user_id = v_user;
  if v_status is null or v_status not in ('joined','waitlist') then
    raise exception 'not_joined' using errcode = '42501';
  end if;

  update plan_participants set status = 'left', left_at = now()
   where plan_id = p_plan and user_id = v_user;

  select user_id into v_promoted from plan_participants
   where plan_id = p_plan and status = 'waitlist' order by joined_at limit 1;
  if v_promoted is not null then
    update plan_participants set status = 'joined'
     where plan_id = p_plan and user_id = v_promoted;
  end if;

  return 'safety_left';
end;
$$;
grant execute on function leave_plan_safety(uuid) to authenticated;
