-- 0011 — push subscriptions.
--
-- A subscription is a URL at Google, Mozilla or Apple plus two keys, and it
-- identifies one browser on one device. That makes it personal data and it
-- makes the push service a recipient, which is why 05-RGPD gets a paragraph
-- and why this table holds nothing else: no user agent, no device name, no
-- last-used-from address.
--
-- What the push service can see is the endpoint and the size of a payload it
-- cannot read — RFC 8291 encrypts to a key only the browser holds. What it
-- cannot see is who the person is, what the plan is, or what the message says.

create table push_subscriptions (
  user_id     uuid not null references profiles on delete cascade,
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  -- Bumped on every successful send, so a subscription that has been dead for
  -- months is identifiable without asking the push service about it.
  last_ok_at  timestamptz
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Your own, and only your own. There is no read path for anyone else at all:
-- sending happens inside a server action that already knows who it is writing
-- to, and a moderator has no reason to see where someone's phone lives.
create policy push_own_read on push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy push_own_write on push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy push_own_update on push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_own_delete on push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

/*
 * Who to notify, for someone entitled to notify them.
 *
 * The caller cannot read `push_subscriptions` for anyone else, and should not
 * be able to — but the person who cancels a plan does have to reach the people
 * who had joined it. So this returns endpoints and keys, and refuses unless
 * the caller is the host or a participant of the plan being notified about,
 * and unless the recipient is too.
 *
 * It deliberately cannot be pointed at a user id: only at a plan the caller is
 * already in, which is exactly the set of people they can already see.
 */
create function push_targets_for_plan(p_plan uuid, p_users uuid[])
  returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.endpoint, s.p256dh, s.auth
    from push_subscriptions s
   where auth.uid() is not null
     and s.user_id <> auth.uid()
     and s.user_id = any (p_users)
     and not is_blocked(auth.uid(), s.user_id)
     -- The caller is in this plan …
     and (is_plan_host(p_plan)
          or exists (select 1 from plan_participants pp
                      where pp.plan_id = p_plan and pp.user_id = auth.uid()
                        and pp.status in ('joined','waitlist','attended')))
     -- … and so is everyone they are about to reach.
     and (exists (select 1 from plans p where p.id = p_plan and p.host_id = s.user_id)
          or exists (select 1 from plan_participants pp
                      where pp.plan_id = p_plan and pp.user_id = s.user_id
                        and pp.status in ('joined','waitlist','attended','removed')));
$$;
grant execute on function push_targets_for_plan(uuid, uuid[]) to authenticated;

/*
 * A dead subscription, retired by whoever discovered it.
 *
 * A push service answers 404 or 410 for an endpoint that no longer exists, and
 * the only code that learns this is the sender — who is not the owner. Scoped
 * to one endpoint the caller was just handed, so it cannot be used to delete
 * subscriptions at large.
 */
create function forget_push_endpoint(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions
   where endpoint = p_endpoint and auth.uid() is not null;
$$;
grant execute on function forget_push_endpoint(text) to authenticated;

/*
 * A plan's roster, for notifying it. Same entitlement rule as above; returns
 * ids the caller can already see on the plan screen.
 */
create function plan_audience(p_plan uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select u from (
    select p.host_id as u from plans p where p.id = p_plan
    union
    select pp.user_id from plan_participants pp
     where pp.plan_id = p_plan and pp.status in ('joined','waitlist')
  ) all_of_them
  where u is not null
    and auth.uid() is not null
    and (is_plan_host(p_plan)
         or exists (select 1 from plan_participants pp
                     where pp.plan_id = p_plan and pp.user_id = auth.uid()
                       and pp.status in ('joined','waitlist','attended')));
$$;
grant execute on function plan_audience(uuid) to authenticated;

-- ── the one notification nobody is in a position to send ────────────────────
/*
 * "Se ha caído alguien y tienes plaza."
 *
 * That string has existed since M1 with nothing able to deliver it, because
 * promotion happens inside leave_plan() under a row lock and the promoted id
 * comes back to nobody. Everything else the app notifies about is sent by the
 * person who caused it, from an action that already knows the recipients.
 *
 * So the promotion marks itself, and the next person entitled to look —
 * normally the leaver, one statement later — claims it. A trigger rather than
 * a change to leave_plan() and leave_plan_safety(), because then it also
 * covers whatever promotes somebody next.
 */
alter table plan_participants add column promoted_at timestamptz;

create function stamp_promotion() returns trigger
language plpgsql as $$
begin
  if old.status = 'waitlist' and new.status = 'joined' then
    new.promoted_at := now();
  end if;
  return new;
end;
$$;

create trigger plan_participants_promotion before update on plan_participants
  for each row execute function stamp_promotion();

/*
 * Claim the pending promotions on a plan and return who to tell.
 *
 * Clearing the mark in the same statement is what makes it once-only: two
 * people leaving at the same moment cannot both send the same notification.
 * Callable by anyone who is or *was* on this plan, which is what includes the
 * person who just left and caused the promotion — and is no wider than the
 * roster they could already see.
 */
create function notify_promotion(p_plan uuid)
  returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql security definer set search_path = public as $$
  with entitled as (
    select 1
     where auth.uid() is not null
       and (is_plan_host(p_plan)
            or exists (select 1 from plan_participants pp
                        where pp.plan_id = p_plan and pp.user_id = auth.uid()))
  ),
  claimed as (
    update plan_participants pp set promoted_at = null
     where pp.plan_id = p_plan
       and pp.promoted_at is not null
       and exists (select 1 from entitled)
    returning pp.user_id
  )
  select s.user_id, s.endpoint, s.p256dh, s.auth
    from claimed c
    join push_subscriptions s on s.user_id = c.user_id
   where not is_blocked(auth.uid(), s.user_id);
$$;
grant execute on function notify_promotion(uuid) to authenticated;

-- ── and closed again ────────────────────────────────────────────────────────
-- Postgres hands EXECUTE on every new function to PUBLIC, and `anon` inherits
-- PUBLIC. 0009 tried to change that for future migrations with ALTER DEFAULT
-- PRIVILEGES; it does not work, and this migration is how that was found. So
-- every migration that adds a function ends with this, and
-- supabase/test/08-privileges.test.sql fails the build when one forgets.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  execute on function public_plan_preview(uuid) to anon;
grant  execute on function has_verified_selfie(uuid) to anon;
