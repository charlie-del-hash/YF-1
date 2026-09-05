-- 0013 — nobody can commit to a plan that was never real.
--
-- The seed exists so the deck is not empty while a city is being started, and
-- 0001 shifts it forward by whole weeks at apply time so it never goes stale.
-- Which means it is permanently in the future, permanently joinable, and
-- hosted by ten profiles that do not correspond to people.
--
-- Everything else in this product is designed around the fact that the failure
-- mode is physical: someone stands in a park at 09:30 on a Saturday. A seed
-- plan is the one case where that outcome is guaranteed for everyone who
-- joins. The card has always said `Plan de ejemplo mientras arrancamos en tu
-- zona`, and a label is not a control.
--
-- Deleting the seed instead is what a launch checklist would normally say, and
-- it is the wrong trade today: three real accounts, one real plan, so removing
-- the examples leaves the next person to sign up looking at an empty app.
-- Visible and refusing beats absent. The deletion is still one statement when
-- the city has plans of its own — docs/LAUNCH.md has it.
--
-- The body below is the live definition of join_plan() with four lines added.
-- It is reproduced rather than rewritten on purpose: a first attempt written
-- from memory quietly dropped the two-falta cooldown and the `swipes` row that
-- stops a joined plan reappearing in the deck.

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

  -- An example is for looking at. Checked before everything else so that the
  -- refusal names the real reason rather than whichever gate it trips next.
  if v_plan.is_seed then raise exception 'seed_plan' using errcode = '42501'; end if;

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

  -- Two faltas in thirty days: a cooldown from the nearly full plans, not a
  -- ban. The plans most likely to leave someone standing are the ones being
  -- protected; everything emptier stays open.
  if v_faltas >= 2 and v_plan.joined_count >= ceil(v_plan.capacity * 0.8) then
    raise exception 'cooldown' using errcode = '42501';
  end if;

  select status into v_existing from plan_participants where plan_id = p_plan and user_id = v_user;
  if v_existing in ('joined','waitlist','attended') then return v_existing; end if;
  if v_existing = 'removed' then raise exception 'removed_by_host' using errcode = '42501'; end if;

  select count(*) into v_count from plan_participants
   where plan_id = p_plan and status in ('joined','attended');

  v_reserved := newcomer_reserved(v_plan.capacity, v_plan.min_plans_required);
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

-- Anyone already committed to an example was committed to nothing. Their
-- membership goes; the seed profiles' own memberships stay, because those are
-- what make the example cards look populated.
delete from plan_participants pp
 using plans p, profiles pr
 where pp.plan_id = p.id
   and pr.id = pp.user_id
   and p.is_seed
   and not pr.is_seed;

-- Postgres re-grants EXECUTE to PUBLIC on a replaced function. See 0009.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  execute on function public_plan_preview(uuid) to anon;
grant  execute on function has_verified_selfie(uuid) to anon;
