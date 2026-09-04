-- 0008 — filling the deck.
--
-- 01-PRD: "A plan that doesn't fill is a failure the app owns." So: measure how
-- long filling takes, make a host's weekly plan cost three taps, put the plans
-- that need people in front of the people who might go, and let a plan be shown
-- to someone who has not signed up yet.

-- ── measuring time to fill ──────────────────────────────────────────────────
-- The build plan's definition of done for this milestone is that median
-- time-to-fill is *measurable*. It is derivable from the participant history,
-- but only expensively and only until someone leaves; stamping it when it
-- happens is one column and cannot be reconstructed later.
alter table plans add column filled_at timestamptz;

create or replace function sync_plan_counts() returns trigger
language plpgsql as $$
declare
  target uuid := coalesce(new.plan_id, old.plan_id);
  n int;
  cap int;
begin
  select count(*) into n from plan_participants
   where plan_id = target and status in ('joined','attended');
  select capacity into cap from plans where id = target;

  update plans
     set joined_count = n,
         status = case
           when status in ('cancelled','completed') then status
           when n >= capacity then 'full'::plan_status
           else 'open'::plan_status
         end,
         -- First time it fills is the one that counts. Dropping below capacity
         -- again does not reset it: the question being answered is "how long
         -- did this take to fill", not "is it full right now".
         filled_at = case when filled_at is null and n >= cap then now() else filled_at end
   where id = target;
  return null;
end;
$$;

create function fill_metrics()
  returns table (
    plans_created int,
    plans_filled int,
    median_hours_to_fill numeric,
    median_hours_of_notice numeric
  )
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         count(*) filter (where filled_at is not null)::int,
         round(percentile_cont(0.5) within group (
           order by extract(epoch from (filled_at - created_at)) / 3600
         )::numeric, 1),
         -- How much warning people gave themselves: creation to start. A deck
         -- that only fills for plans posted three weeks out is a different
         -- problem from one that never fills at all.
         round(percentile_cont(0.5) within group (
           order by extract(epoch from (starts_at - created_at)) / 3600
         )::numeric, 1)
    from plans
   where not is_seed and is_admin();
$$;
grant execute on function fill_metrics() to authenticated;

-- ── recurring plans ─────────────────────────────────────────────────────────
-- `recurring_rule` existed from 0001 and was never used. A full RRULE is more
-- than anyone here needs: the thing hosts actually have is a fixed weekly
-- session, so that is what this supports, and anything else can stay manual
-- until someone asks.
alter table plans add constraint recurring_rule_known
  check (recurring_rule is null or recurring_rule = 'weekly');

-- Occurrences of the same weekly plan share a series, so "the Sunday pachanga"
-- is one thing with a history rather than forty unrelated rows.
alter table plans add column series_id uuid;
create index plans_series_idx on plans (series_id, starts_at);

/*
 * Make the next week's occurrence, once this week's has started.
 *
 * Lazy, like attendance settlement, and for the same reason: there is no
 * scheduler in this project. Called when a host opens `Mis planes`. Idempotent
 * — a series that already has a future occurrence gets nothing.
 */
create function materialise_my_recurring() returns int
language plpgsql security definer set search_path = public as $$
declare v_plan plans%rowtype; v_made int := 0; v_series uuid; v_next timestamptz;
begin
  if auth.uid() is null then return 0; end if;

  for v_plan in
    select * from plans
     where host_id = auth.uid() and recurring_rule = 'weekly'
       and status <> 'cancelled' and starts_at <= now()
  loop
    v_series := coalesce(v_plan.series_id, v_plan.id);
    v_next := v_plan.starts_at + interval '7 days';
    -- Catch up if the host has been away for a few weeks.
    while v_next <= now() loop v_next := v_next + interval '7 days'; end loop;

    if not exists (
      select 1 from plans
       where coalesce(series_id, id) = v_series and starts_at > now()
         and status <> 'cancelled'
    ) then
      insert into plans (host_id, sport, title, starts_at, duration_min, venue_id,
                         meeting_note, distrito, level_min, level_max, level_display,
                         capacity, third_half, third_half_venue_id, audience,
                         min_plans_required, recurring_rule, series_id)
      values (v_plan.host_id, v_plan.sport, v_plan.title, v_next, v_plan.duration_min,
              v_plan.venue_id, v_plan.meeting_note, v_plan.distrito, v_plan.level_min,
              v_plan.level_max, v_plan.level_display, v_plan.capacity, v_plan.third_half,
              v_plan.third_half_venue_id, v_plan.audience, v_plan.min_plans_required,
              'weekly', v_series);
      v_made := v_made + 1;
    end if;

    -- The occurrence that just happened stops being the recurring one, so the
    -- series never sprouts two futures.
    update plans set recurring_rule = null, series_id = v_series where id = v_plan.id;
  end loop;

  return v_made;
end;
$$;
grant execute on function materialise_my_recurring() to authenticated;

-- ── who usually shows up ────────────────────────────────────────────────────
-- 01-PRD's host tools. Deliberately only counts people who actually attended
-- the caller's own plans: it answers "who are my regulars", not "who is
-- popular", and it is not a leaderboard of anybody.
create function my_regulars()
  returns table (user_id uuid, display_name text, dorsal_number int, attended int)
language sql stable security definer set search_path = public as $$
  select pp.user_id, p.display_name, p.dorsal_number, count(*)::int
    from plan_participants pp
    join plans pl on pl.id = pp.plan_id
    join profiles p on p.id = pp.user_id
   where pl.host_id = auth.uid() and pp.status = 'attended'
     and not p.is_suspended
     and not is_blocked(auth.uid(), pp.user_id)
   group by pp.user_id, p.display_name, p.dorsal_number
  having count(*) >= 2
   order by count(*) desc
   limit 20;
$$;
grant execute on function my_regulars() to authenticated;

-- ── rescuing a plan that is not filling ─────────────────────────────────────
/*
 * Candidates for a plan that needs people.
 *
 * The interesting part is that this deliberately *includes* people who swiped
 * left on a similar plan — 01-PRD asks for exactly that, and it is the only
 * query in the product that reaches past a left swipe. The justification is
 * narrow: passing on one Tuesday run is not a standing instruction about
 * running, and the plan being short of people is new information.
 *
 * It stays honest by only returning people whose level actually fits, never
 * showing a solo_mujeres plan to anyone who cannot see it, and never reaching
 * past a *right* swipe or an existing membership.
 */
create function plans_needing_people(p_within_hours int default 48)
  returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id
    from plans p
    join user_sports us on us.user_id = auth.uid() and us.sport = p.sport
   where auth.uid() is not null
     and p.status = 'open'
     and p.starts_at > now()
     and p.starts_at < now() + make_interval(hours => p_within_hours)
     and p.joined_count < ceil(p.capacity * 0.6)
     and p.host_id <> auth.uid()
     and us.level_norm between p.level_min and p.level_max
     and (p.audience = 'todos' or viewer_is_mujer())
     and not is_blocked(auth.uid(), p.host_id)
     and not exists (
       select 1 from plan_participants pp
        where pp.plan_id = p.id and pp.user_id = auth.uid()
          and pp.status in ('joined','waitlist','attended','removed')
     )
     and not exists (
       select 1 from swipes s
        where s.plan_id = p.id and s.user_id = auth.uid() and s.direction = 'right'
     )
   order by p.starts_at
   limit 10;
$$;
grant execute on function plans_needing_people(int) to authenticated;

-- ── share links ─────────────────────────────────────────────────────────────
/*
 * What someone without an account may see.
 *
 * Every other read in this product goes through RLS and requires a session.
 * This one does not, so it is the one function where the audience check has to
 * be written out by hand — and it refuses a solo_mujeres plan outright rather
 * than filtering it, because a share link is a URL that travels.
 *
 * It returns no roster, no host surname, no coordinates and no note: enough to
 * decide whether to sign up, and nothing that makes a stranger's plan legible
 * to someone who has not.
 */
create function public_plan_preview(p_plan uuid)
  returns table (
    id uuid,
    sport sport_key,
    starts_at timestamptz,
    duration_min int,
    distrito text,
    level_display text,
    capacity int,
    joined_count int,
    third_half third_half,
    venue_name text,
    host_name text
  )
language sql stable security definer set search_path = public as $$
  select p.id, p.sport, p.starts_at, p.duration_min, p.distrito, p.level_display,
         p.capacity, p.joined_count, p.third_half,
         v.name, h.display_name
    from plans p
    left join venues v on v.id = p.venue_id
    left join profiles h on h.id = p.host_id
   where p.id = p_plan
     and p.audience = 'todos'
     and p.status in ('open','full')
     and p.starts_at > now();
$$;
grant execute on function public_plan_preview(uuid) to anon, authenticated;
