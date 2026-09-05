-- 0002 — plans become real: leaving, waitlist promotion, editing, cancelling.
--
-- reliability_events arrives here rather than in its M3 slot because
-- leave_plan() has to record what a cancellation cost at the moment it happens.
-- Palabra itself — the derived view, the display, the gates — is still M3. The
-- events are simply not reconstructable after the fact, so they are captured
-- now and read later.

create table reliability_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  plan_id    uuid references plans on delete set null,
  kind       text not null check (kind in
              ('attended','no_show','late_cancel','early_cancel','hosted','disputed')),
  created_at timestamptz not null default now()
);
create index reliability_events_user_idx on reliability_events (user_id, created_at desc);

alter table reliability_events enable row level security;

-- Own rows only, and only ever written by security-definer functions: a user
-- who could insert their own 'attended' rows could manufacture a reputation.
create policy reliability_read_own on reliability_events for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ── the cancellation rule, in one place ─────────────────────────────────────
-- 02-DATA-MODEL leaves the 12–24h window undecided. It is free here, and the
-- reason is 01-PRD's own worry about the score chilling participation: someone
-- cancelling 18 hours out has given the host most of a day to refill the plaza,
-- and penalising that teaches tentative newcomers — the primary user — not to
-- join at all. Under 12 hours a plaza realistically cannot be refilled, so that
-- is where the falta starts.
--
-- This function is the only definition of that rule. The UI does not compute
-- it; it asks, so that the words on the confirmation dialog and the row written
-- to reliability_events can never disagree.
create function late_cancel_threshold() returns interval
language sql immutable as $$ select interval '12 hours' $$;

create function leave_cost(p_plan uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
           when p.starts_at - now() >= late_cancel_threshold() then 'early_cancel'
           else 'late_cancel'
         end
    from plans p
   where p.id = p_plan;
$$;
grant execute on function leave_cost(uuid) to authenticated;

-- ── leave_plan ──────────────────────────────────────────────────────────────
-- Returns what it cost. Promotes the first waitlisted person in the same
-- transaction, under the same row lock that join_plan() takes, so a plaza can
-- never be freed and taken twice.
create function leave_plan(p_plan uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_plan     plans%rowtype;
  v_status   join_status;
  v_cost     text;
  v_promoted uuid;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_plan from plans where id = p_plan for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if v_plan.host_id = v_user then raise exception 'host_cannot_leave' using errcode = '42501'; end if;

  select status into v_status from plan_participants
   where plan_id = p_plan and user_id = v_user;
  if v_status is null or v_status not in ('joined','waitlist') then
    raise exception 'not_joined' using errcode = '42501';
  end if;

  -- Giving up a waitlist place costs nothing: there was never a plaza to lose.
  if v_status = 'waitlist' then
    update plan_participants set status = 'left', left_at = now()
     where plan_id = p_plan and user_id = v_user;
    return 'waitlist_left';
  end if;

  v_cost := leave_cost(p_plan);

  update plan_participants set status = 'left', left_at = now()
   where plan_id = p_plan and user_id = v_user;

  -- A cancelled plan is the host's doing, not the participant's, so leaving one
  -- is never a falta.
  if v_plan.status <> 'cancelled' then
    insert into reliability_events (user_id, plan_id, kind) values (v_user, p_plan, v_cost);
  end if;

  -- First in, first promoted.
  select user_id into v_promoted from plan_participants
   where plan_id = p_plan and status = 'waitlist'
   order by joined_at
   limit 1;

  if v_promoted is not null then
    update plan_participants set status = 'joined'
     where plan_id = p_plan and user_id = v_promoted;
  end if;

  return v_cost;
end;
$$;
revoke all on function leave_plan(uuid) from public;
grant execute on function leave_plan(uuid) to authenticated;

-- ── cancelling a plan ───────────────────────────────────────────────────────
-- A reason is required. "The plan is off" without one is how a group stops
-- trusting a host, and the reason is the only thing participants get until web
-- push lands in M2.
create function cancel_plan(p_plan uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_plan plans%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_plan from plans where id = p_plan for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if v_plan.host_id <> auth.uid() then raise exception 'not_host' using errcode = '42501'; end if;
  if v_plan.status = 'cancelled' then return; end if;

  update plans set status = 'cancelled', cancelled_reason = btrim(p_reason) where id = p_plan;
end;
$$;
revoke all on function cancel_plan(uuid, text) from public;
grant execute on function cancel_plan(uuid, text) to authenticated;

-- A cancelled plan stays cancelled. Un-cancelling would silently re-commit
-- everyone who had already made other arrangements.
create function forbid_uncancel() returns trigger
language plpgsql as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'plan_already_cancelled' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger plans_no_uncancel before update of status on plans
  for each row execute function forbid_uncancel();

-- ── hosting is a reliability event too ──────────────────────────────────────
create function record_hosting() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into reliability_events (user_id, plan_id, kind) values (new.host_id, new.id, 'hosted');
  return null;
end;
$$;
create trigger plans_record_hosting after insert on plans
  for each row execute function record_hosting();
