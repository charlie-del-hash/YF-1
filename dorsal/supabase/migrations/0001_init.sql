-- 0001 — Dorsal core schema (M0)
-- profiles, user_sports, venues, plans, plan_participants, swipes, blocks.
-- Every table gets RLS in this same migration. CLAUDE.md rule 2.
--
-- `blocks` is here even though the build plan lists it later: the plans and
-- profiles read policies below are written in terms of it, and shipping those
-- policies without the table would mean writing them twice.

-- ── extensions ───────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── enums ────────────────────────────────────────────────────────────────────
create type sport_key as enum (
  'running','padel','tenis','futbol','baloncesto','ciclismo',
  'escalada','natacion','hyrox','senderismo','yoga','fuerza'
);
create type plan_status  as enum ('open','full','cancelled','completed');
create type join_status  as enum ('joined','waitlist','left','removed','no_show','attended');
create type third_half   as enum ('cafe','cana','desayuno','comida','ninguno');
create type audience     as enum ('todos','solo_mujeres');
create type gender_decl  as enum ('mujer','hombre','no_binario','prefiero_no_decirlo');
create type verification as enum ('email','phone','selfie');
create type level_scale  as enum ('pace_min_km','padel_1_7','football_tier','speed_kmh','climb_grade','generic_3');

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Deviation from 02-DATA-MODEL: the row is created when onboarding completes
-- (see complete_onboarding below), not by a trigger on signup. display_name,
-- distrito and birth_year are NOT NULL and are only collected in onboarding; a
-- trigger row would have to invent placeholders, and a placeholder profile is
-- indistinguishable from a real one on a plan roster. "No profile row" is the
-- honest representation of "signed up, hasn't onboarded".
create sequence dorsal_number_seq start 1000;

create table profiles (
  id             uuid primary key references auth.users on delete cascade,
  dorsal_number  int  unique not null default nextval('dorsal_number_seq'),
  display_name   text not null check (char_length(display_name) between 2 and 40),
  photo_url      text,
  birth_year     int  not null check (birth_year between 1900 and 2100),
  gender         gender_decl,
  distrito       text not null,
  travel_km      int  not null default 5 check (travel_km between 1 and 30),
  bio            text check (char_length(bio) <= 140),
  created_at     timestamptz not null default now(),
  last_active_at timestamptz,
  is_suspended   boolean not null default false,
  is_seed        boolean not null default false
);
comment on column profiles.gender is
  '05-RGPD §3: optional, exists only to gate solo_mujeres plans, never shown publicly.';

-- 18+ (CLAUDE.md rule 8) cannot be a CHECK constraint: Postgres requires CHECK
-- expressions to be immutable and now() is not. A trigger enforces it instead,
-- on insert and on update.
create function enforce_adult() returns trigger
language plpgsql as $$
begin
  if new.birth_year > extract(year from now())::int - 18 then
    raise exception 'under_18' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger profiles_adult before insert or update of birth_year on profiles
  for each row execute function enforce_adult();

-- ── blocks ───────────────────────────────────────────────────────────────────
create table blocks (
  blocker_id uuid not null references profiles on delete cascade,
  blocked_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks (blocked_id);

-- Security-definer helpers. These read tables the caller may not be able to
-- read directly, which is the point: they answer a yes/no question without
-- leaking rows, and they stop RLS policies recursing into the tables they
-- protect.
create function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create function viewer_is_mujer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select gender = 'mujer' from profiles where id = auth.uid()), false);
$$;

-- ── user_sports ──────────────────────────────────────────────────────────────
create table user_sports (
  user_id     uuid not null references profiles on delete cascade,
  sport       sport_key not null,
  level_norm  int not null check (level_norm between 1 and 10),
  level_value jsonb not null default '{}'::jsonb,
  primary key (user_id, sport)
);

-- ── venues ───────────────────────────────────────────────────────────────────
create table venues (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique,
  name       text not null,
  kind       text not null check (kind in ('parque','polideportivo','rocodromo','pista','cafe','otro')),
  distrito   text not null,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  is_public  boolean not null default true,
  verified   boolean not null default false,
  created_by uuid references profiles on delete set null,
  is_seed    boolean not null default false,
  created_at timestamptz not null default now(),
  -- 01-PRD §Trust and safety: meeting points are public places, always.
  constraint public_only check (is_public)
);
comment on column venues.verified is
  'false = coordinates not yet confirmed against a real source. The UI must label these; they are never presented as a confirmed meeting point.';

-- ── plans ────────────────────────────────────────────────────────────────────
create table plans (
  id                  uuid primary key default gen_random_uuid(),
  host_id             uuid not null references profiles on delete cascade,
  sport               sport_key not null,
  title               text check (char_length(title) <= 80),
  starts_at           timestamptz not null,
  duration_min        int not null default 60 check (duration_min between 15 and 600),
  venue_id            uuid references venues on delete restrict,
  meeting_note        text check (char_length(meeting_note) <= 200),
  distrito            text not null,
  level_min           int not null check (level_min between 1 and 10),
  level_max           int not null check (level_max between 1 and 10),
  level_display       text not null,
  capacity            int not null check (capacity between 2 and 40),
  joined_count        int not null default 0 check (joined_count >= 0),
  third_half          third_half not null default 'ninguno',
  third_half_venue_id uuid references venues on delete set null,
  audience            audience not null default 'todos',
  min_plans_required  int not null default 0 check (min_plans_required between 0 and 10),
  status              plan_status not null default 'open',
  cancelled_reason    text,
  recurring_rule      text,
  is_seed             boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint level_order check (level_min <= level_max),
  constraint future_start check (starts_at > created_at),
  constraint within_capacity check (joined_count <= capacity)
);
create index plans_upcoming_idx on plans (starts_at) where status in ('open','full');
create index plans_discovery_idx on plans (sport, distrito, starts_at);
create index plans_host_idx on plans (host_id);

-- ── plan_participants ────────────────────────────────────────────────────────
create table plan_participants (
  plan_id     uuid not null references plans on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  status      join_status not null default 'joined',
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  host_marked boolean,
  self_marked boolean,
  primary key (plan_id, user_id)
);
create index plan_participants_user_idx on plan_participants (user_id, status);

-- joined_count is denormalised for the deck query and for display. It is
-- maintained in the same transaction as the membership change, so it can never
-- drift; join_plan still counts under a row lock rather than trusting it.
create function sync_plan_counts() returns trigger
language plpgsql as $$
declare
  target uuid := coalesce(new.plan_id, old.plan_id);
  n int;
begin
  select count(*) into n from plan_participants
   where plan_id = target and status in ('joined','attended');
  update plans
     set joined_count = n,
         status = case
           when status in ('cancelled','completed') then status
           when n >= capacity then 'full'::plan_status
           else 'open'::plan_status
         end
   where id = target;
  return null;
end;
$$;
create trigger plan_participants_count
  after insert or update of status or delete on plan_participants
  for each row execute function sync_plan_counts();

-- ── swipes ───────────────────────────────────────────────────────────────────
-- Left swipes are kept on purpose: they stop the deck repeating itself, and
-- they are the candidate pool for rescuing an under-filled plan (M5).
create table swipes (
  user_id    uuid not null references profiles on delete cascade,
  plan_id    uuid not null references plans on delete cascade,
  direction  text not null check (direction in ('right','left')),
  created_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

-- ── visibility helpers ───────────────────────────────────────────────────────
create function can_see_plan(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p
     where p.id = p_plan
       and auth.uid() is not null
       and not is_blocked(auth.uid(), p.host_id)
       and (p.audience = 'todos' or viewer_is_mujer())
  );
$$;

create function is_plan_host(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plans where id = p_plan and host_id = auth.uid());
$$;

create function completed_plan_count(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from plan_participants
   where user_id = p_user and status = 'attended';
$$;

-- ── join_plan ────────────────────────────────────────────────────────────────
-- Capacity is decided here, under a row lock, never in application code:
-- two people tapping "Me apunto" on the last plaza must not both get it.
-- 02-DATA-MODEL §plan_participants.
create function join_plan(p_plan uuid) returns join_status
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_plan  plans%rowtype;
  v_me    profiles%rowtype;
  v_level int;
  v_count int;
  v_existing join_status;
  v_result join_status;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_me from profiles where id = v_user;
  if not found then raise exception 'no_profile' using errcode = 'P0002'; end if;
  if v_me.is_suspended then raise exception 'suspended' using errcode = '42501'; end if;

  -- The lock serialises concurrent joins on this plan and nothing else.
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

  if completed_plan_count(v_user) < v_plan.min_plans_required then
    raise exception 'needs_more_plans' using errcode = '42501';
  end if;

  select status into v_existing from plan_participants where plan_id = p_plan and user_id = v_user;
  if v_existing in ('joined','waitlist','attended') then return v_existing; end if;
  if v_existing = 'removed' then raise exception 'removed_by_host' using errcode = '42501'; end if;

  select count(*) into v_count from plan_participants
   where plan_id = p_plan and status in ('joined','attended');
  v_result := case when v_count >= v_plan.capacity then 'waitlist' else 'joined' end::join_status;

  insert into plan_participants (plan_id, user_id, status, joined_at, left_at)
       values (p_plan, v_user, v_result, now(), null)
  on conflict (plan_id, user_id)
       do update set status = excluded.status, joined_at = now(), left_at = null;

  insert into swipes (user_id, plan_id, direction) values (v_user, p_plan, 'right')
  on conflict (user_id, plan_id) do update set direction = 'right', created_at = now();

  return v_result;
end;
$$;
revoke all on function join_plan(uuid) from public;
grant execute on function join_plan(uuid) to authenticated;

-- ── onboarding ───────────────────────────────────────────────────────────────
create function complete_onboarding(
  p_display_name text,
  p_birth_year   int,
  p_distrito     text,
  p_travel_km    int,
  p_gender       gender_decl,
  p_photo_url    text,
  p_sports       jsonb            -- [{"sport":"running","level_norm":5,"level_value":{}}]
) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row  profiles%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if jsonb_array_length(coalesce(p_sports, '[]'::jsonb)) = 0 then
    raise exception 'no_sports' using errcode = '22023';
  end if;

  insert into profiles (id, display_name, birth_year, distrito, travel_km, gender, photo_url)
       values (v_user, p_display_name, p_birth_year, p_distrito, p_travel_km, p_gender, p_photo_url)
  on conflict (id) do update
       set display_name = excluded.display_name,
           birth_year   = excluded.birth_year,
           distrito     = excluded.distrito,
           travel_km    = excluded.travel_km,
           gender       = excluded.gender,
           photo_url    = coalesce(excluded.photo_url, profiles.photo_url)
    returning * into v_row;

  delete from user_sports where user_id = v_user;
  insert into user_sports (user_id, sport, level_norm, level_value)
  select v_user,
         (s->>'sport')::sport_key,
         (s->>'level_norm')::int,
         coalesce(s->'level_value', '{}'::jsonb)
    from jsonb_array_elements(p_sports) s;

  return v_row;
end;
$$;
revoke all on function complete_onboarding(text,int,text,int,gender_decl,text,jsonb) from public;
grant execute on function complete_onboarding(text,int,text,int,gender_decl,text,jsonb) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles          enable row level security;
alter table user_sports       enable row level security;
alter table venues            enable row level security;
alter table plans             enable row level security;
alter table plan_participants enable row level security;
alter table swipes            enable row level security;
alter table blocks            enable row level security;

-- profiles: visible to signed-in users unless a block exists either way.
-- Every read policy starts by requiring a subject. The `authenticated` role
-- without a JWT subject should never happen in front of PostgREST, but "should
-- never happen" is not an access control, and the cost here is one comparison.
create policy profiles_read on profiles for select to authenticated
  using (
    (select auth.uid()) is not null
    and (id = (select auth.uid()) or not is_blocked((select auth.uid()), id))
  );
create policy profiles_insert_own on profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_sports: same visibility as the profile it belongs to.
create policy user_sports_read on user_sports for select to authenticated
  using (
    (select auth.uid()) is not null
    and (user_id = (select auth.uid()) or not is_blocked((select auth.uid()), user_id))
  );
create policy user_sports_write_own on user_sports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- venues: public meeting points, readable by any signed-in user.
create policy venues_read on venues for select to authenticated
  using ((select auth.uid()) is not null);
create policy venues_insert on venues for insert to authenticated
  with check (created_by = (select auth.uid()) and is_public);
create policy venues_update_own on venues for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- plans: solo_mujeres plans are filtered here, in the one place every query
-- path goes through — deck, detail, share link and notification alike.
create policy plans_read on plans for select to authenticated
  using (
    (select auth.uid()) is not null
    and not is_blocked((select auth.uid()), host_id)
    and (audience = 'todos' or viewer_is_mujer())
  );
create policy plans_insert_own on plans for insert to authenticated
  with check (host_id = (select auth.uid()));
create policy plans_update_host on plans for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));

-- plan_participants: the roster is visible to anyone who can see the plan (you
-- need to know who is going before you decide to go), minus blocked pairs.
-- There is deliberately no INSERT policy: joining goes through join_plan().
create policy participants_read on plan_participants for select to authenticated
  using (
    (select auth.uid()) is not null
    and can_see_plan(plan_id)
    and (user_id = (select auth.uid()) or not is_blocked((select auth.uid()), user_id))
  );
create policy participants_update_own on plan_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy participants_update_host on plan_participants for update to authenticated
  using (is_plan_host(plan_id)) with check (is_plan_host(plan_id));

-- swipes / blocks: strictly own rows.
create policy swipes_own on swipes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy blocks_own on blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- ── public_profiles ──────────────────────────────────────────────────────────
-- The only shape of a profile the app is allowed to render for someone else.
-- security_invoker keeps the profiles policies in force through the view, so
-- blocked users disappear here too. gender and birth_year are not columns here.
create view public_profiles with (security_invoker = on) as
  select id, dorsal_number, display_name, photo_url, distrito, bio, created_at
    from profiles
   where not is_suspended;

grant select on public_profiles to authenticated;
