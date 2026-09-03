-- 0004 — Palabra. Attendance, and what it opens and closes.
--
-- 01-PRD is emphatic that reliability is a *gate*, not a scoreboard: nobody
-- should feel ranked. So nothing here computes a score. What exists is an
-- append-only event log, an aggregate that is only ever shown as "12 planes ·
-- 100% asistencia" or "Nuevo por aquí", and two consequences — a cooldown and
-- a minimum-plans gate — both of which are bounded so they cannot lock a new
-- user out of the product entirely.

alter table plan_participants
  add column settled_at timestamptz,
  -- True when only one side ever answered. Repeated one-sided settlements are
  -- what "the responding side is trusted once" is measured against.
  add column one_sided  boolean not null default false;

-- The gate is capped at two plans, not ten.
--
-- 02-DATA-MODEL allows up to ten and the pre-build audit is right that this is
-- a catch-22 waiting to happen: the users most likely to be gated out are
-- exactly the ones 01-PRD names as primary — someone who just moved to Madrid
-- and has no history anywhere. Two is enough for a host to filter out drive-by
-- joins and low enough that two weekends of showing up clears it.
alter table plans drop constraint plans_min_plans_required_check;
alter table plans add constraint plans_min_plans_required_check
  check (min_plans_required between 0 and 2);

-- ── the aggregate ───────────────────────────────────────────────────────────
create view user_reliability as
select p.id as user_id,
       count(*) filter (where e.kind = 'attended')                          as attended,
       count(*) filter (where e.kind in ('attended','no_show','late_cancel')) as commitments,
       count(*) filter (where e.kind = 'hosted')                            as hosted,
       count(*) filter (where e.kind in ('no_show','late_cancel')
                          and e.created_at > now() - interval '30 days')    as recent_faltas,
       count(*) filter (where e.kind = 'disputed')                          as disputes
  from profiles p
  left join reliability_events e on e.user_id = p.id
 group by p.id;

-- Reliability rows are private (0002), so the aggregate cannot be a
-- security_invoker view if a roster is to show anything at all. This function
-- is the only way one person sees another's record, and it returns three
-- numbers — never the events, never a rank, never a comparison.
create function public_palabra(p_user uuid)
  returns table (plans int, attendance_pct int, is_newcomer boolean)
language sql stable security definer set search_path = public as $$
  select r.attended::int,
         case when r.commitments = 0 then null
              else round(100.0 * r.attended / r.commitments)::int end,
         (r.commitments = 0)
    from user_reliability r
   where r.user_id = p_user
     and auth.uid() is not null
     and not is_blocked(auth.uid(), p_user);
$$;
grant execute on function public_palabra(uuid) to authenticated;

-- ── reserved plazas ─────────────────────────────────────────────────────────
-- 01-PRD: "New users always have at least some open plans available to them —
-- otherwise nobody can ever start." The gate alone is not enough, because an
-- ungated plan that fills with regulars is just as closed to a newcomer as a
-- gated one. So on every ungated plan big enough to spare it, one plaza is held
-- back for someone with no history. Established users are waitlisted for it,
-- not refused: the plaza opens to them if no newcomer takes it by the time
-- someone drops out.
create function newcomer_reserved(p_capacity int, p_min_plans int) returns int
language sql immutable as $$
  select case when p_min_plans = 0 and p_capacity >= 4 then 1 else 0 end;
$$;

-- ── joining, with Palabra in the way ────────────────────────────────────────
create or replace function join_plan(p_plan uuid) returns join_status
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_plan  plans%rowtype;
  v_me    profiles%rowtype;
  v_level int;
  v_count int;
  v_done  int;
  v_faltas int;
  v_reserved int;
  v_effective int;
  v_existing join_status;
  v_result join_status;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_me from profiles where id = v_user;
  if not found then raise exception 'no_profile' using errcode = 'P0002'; end if;
  if v_me.is_suspended then raise exception 'suspended' using errcode = '42501'; end if;

  select * into v_plan from plans where id = p_plan for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if v_plan.status in ('cancelled','completed') then
    raise exception 'plan_closed' using errcode = '42501';
  end if;
  if v_plan.starts_at <= now() then raise exception 'plan_started' using errcode = '42501'; end if;
  if v_plan.host_id = v_user then raise exception 'host_cannot_join' using errcode = '42501'; end if;

  if is_blocked(v_user, v_plan.host_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if exists (
    select 1 from plan_participants pp
     where pp.plan_id = p_plan and pp.status in ('joined','waitlist','attended')
       and is_blocked(v_user, pp.user_id)
  ) then
    raise exception 'blocked' using errcode = '42501';
  end if;

  if v_plan.audience = 'solo_mujeres' and coalesce(v_me.gender, 'prefiero_no_decirlo') <> 'mujer' then
    raise exception 'solo_mujeres' using errcode = '42501';
  end if;

  select level_norm into v_level from user_sports where user_id = v_user and sport = v_plan.sport;
  if v_level is null or v_level < v_plan.level_min or v_level > v_plan.level_max then
    raise exception 'level_mismatch' using errcode = '42501';
  end if;

  select attended, recent_faltas into v_done, v_faltas
    from user_reliability where user_id = v_user;
  v_done := coalesce(v_done, 0);
  v_faltas := coalesce(v_faltas, 0);

  if v_done < v_plan.min_plans_required then
    raise exception 'needs_more_plans' using errcode = '42501';
  end if;

  -- Two faltas in thirty days: a cooldown from the plans that are nearly full,
  -- not a ban. 01-PRD is explicit that this is humane by design — the plans
  -- most likely to have someone left standing are the ones being protected,
  -- and everything emptier stays open.
  if v_faltas >= 2 and v_plan.joined_count >= ceil(v_plan.capacity * 0.8) then
    raise exception 'cooldown' using errcode = '42501';
  end if;

  select status into v_existing from plan_participants where plan_id = p_plan and user_id = v_user;
  if v_existing in ('joined','waitlist','attended') then return v_existing; end if;
  if v_existing = 'removed' then raise exception 'removed_by_host' using errcode = '42501'; end if;

  select count(*) into v_count from plan_participants
   where plan_id = p_plan and status in ('joined','attended');

  v_reserved := newcomer_reserved(v_plan.capacity, v_plan.min_plans_required);
  -- Someone with no history is a newcomer and may use the reserved plaza.
  v_effective := case when v_done = 0 then v_plan.capacity
                      else v_plan.capacity - v_reserved end;

  v_result := case when v_count >= v_effective then 'waitlist' else 'joined' end::join_status;

  insert into plan_participants (plan_id, user_id, status, joined_at, left_at)
       values (p_plan, v_user, v_result, now(), null)
  on conflict (plan_id, user_id)
       do update set status = excluded.status, joined_at = now(), left_at = null;

  insert into swipes (user_id, plan_id, direction) values (v_user, p_plan, 'right')
  on conflict (user_id, plan_id) do update set direction = 'right', created_at = now();

  return v_result;
end;
$$;
grant execute on function join_plan(uuid) to authenticated;

-- ── marking who came ────────────────────────────────────────────────────────
create function plan_ended_at(p_plan uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select starts_at + make_interval(mins => duration_min) from plans where id = p_plan;
$$;

/*
 * Settlement. 02-DATA-MODEL §Domain rules 5.
 *
 * Both sides agree            -> recorded, and that is the normal case.
 * They disagree               -> neither is penalised; a 'disputed' event is
 *                                logged, and three of those is what gets a
 *                                person looked at by a human.
 * Only one side ever answers  -> after 72 hours the answer that exists is
 *                                trusted, and the row is marked one_sided so
 *                                that a pattern of it is visible later.
 *
 * Idempotent, and safe to call on any plan at any time: rows that cannot be
 * settled yet are left alone. There is no scheduler in this project, so it is
 * called after each mark and lazily when someone opens `Mis planes`.
 */
create function settle_attendance(p_plan uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_end     timestamptz := plan_ended_at(p_plan);
  v_row     record;
  v_settled int := 0;
  v_agreed  boolean;
begin
  if v_end is null or v_end > now() then return 0; end if;

  for v_row in
    select * from plan_participants
     where plan_id = p_plan and settled_at is null
       and status in ('joined','attended','no_show')
  loop
    if v_row.host_marked is not null and v_row.self_marked is not null then
      if v_row.host_marked = v_row.self_marked then
        v_agreed := v_row.host_marked;
        update plan_participants
           set status = case when v_agreed then 'attended' else 'no_show' end::join_status,
               settled_at = now()
         where plan_id = p_plan and user_id = v_row.user_id;
        insert into reliability_events (user_id, plan_id, kind)
             values (v_row.user_id, p_plan, case when v_agreed then 'attended' else 'no_show' end);
      else
        -- Nobody is penalised for a disagreement.
        update plan_participants set settled_at = now()
         where plan_id = p_plan and user_id = v_row.user_id;
        insert into reliability_events (user_id, plan_id, kind)
             values (v_row.user_id, p_plan, 'disputed');
      end if;
      v_settled := v_settled + 1;

    elsif now() > v_end + interval '72 hours'
          and (v_row.host_marked is not null or v_row.self_marked is not null) then
      v_agreed := coalesce(v_row.host_marked, v_row.self_marked);
      update plan_participants
         set status = case when v_agreed then 'attended' else 'no_show' end::join_status,
             settled_at = now(), one_sided = true
       where plan_id = p_plan and user_id = v_row.user_id;
      insert into reliability_events (user_id, plan_id, kind)
           values (v_row.user_id, p_plan, case when v_agreed then 'attended' else 'no_show' end);
      v_settled := v_settled + 1;
    end if;
  end loop;

  return v_settled;
end;
$$;

-- The host marks the roster. One tap per person, after the plan.
create function mark_attendance(p_plan uuid, p_user uuid, p_came boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from plans where id = p_plan and host_id = auth.uid()) then
    raise exception 'not_host' using errcode = '42501';
  end if;
  if plan_ended_at(p_plan) > now() then raise exception 'plan_not_finished' using errcode = '42501'; end if;

  update plan_participants set host_marked = p_came
   where plan_id = p_plan and user_id = p_user and settled_at is null;
  if not found then raise exception 'not_in_plan' using errcode = 'P0002'; end if;

  perform settle_attendance(p_plan);
end;
$$;

-- And the participant confirms for themselves. 01-PRD's own worry about host
-- diligence is why this side exists: if only one of the two ever answers, the
-- one that did is what gets recorded.
create function confirm_attendance(p_plan uuid, p_came boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if plan_ended_at(p_plan) > now() then raise exception 'plan_not_finished' using errcode = '42501'; end if;

  update plan_participants set self_marked = p_came
   where plan_id = p_plan and user_id = auth.uid() and settled_at is null;
  if not found then raise exception 'not_in_plan' using errcode = 'P0002'; end if;

  perform settle_attendance(p_plan);
end;
$$;

-- Lazy settlement for plans whose 72h window has passed with only one answer.
-- Called when someone opens `Mis planes`; a scheduler would do this properly.
create function settle_my_overdue_plans() returns int
language plpgsql security definer set search_path = public as $$
declare v_plan uuid; v_total int := 0;
begin
  for v_plan in
    select distinct pp.plan_id from plan_participants pp
      join plans p on p.id = pp.plan_id
     where pp.settled_at is null
       and (pp.user_id = auth.uid() or p.host_id = auth.uid())
       and p.starts_at + make_interval(mins => p.duration_min) + interval '72 hours' < now()
  loop
    v_total := v_total + settle_attendance(v_plan);
  end loop;
  return v_total;
end;
$$;

revoke all on function mark_attendance(uuid, uuid, boolean),
                      confirm_attendance(uuid, boolean),
                      settle_attendance(uuid),
                      settle_my_overdue_plans() from public;
grant execute on function mark_attendance(uuid, uuid, boolean),
                         confirm_attendance(uuid, boolean),
                         settle_my_overdue_plans() to authenticated;

-- The roster shows a Palabra next to each person, so the batch form exists to
-- avoid one round trip per participant on every plan screen.
create function public_palabra_many(p_users uuid[])
  returns table (user_id uuid, plans int, attendance_pct int, is_newcomer boolean)
language sql stable security definer set search_path = public as $$
  select r.user_id,
         r.attended::int,
         case when r.commitments = 0 then null
              else round(100.0 * r.attended / r.commitments)::int end,
         (r.commitments = 0)
    from user_reliability r
   where r.user_id = any(p_users)
     and auth.uid() is not null
     and not is_blocked(auth.uid(), r.user_id);
$$;
grant execute on function public_palabra_many(uuid[]) to authenticated;
