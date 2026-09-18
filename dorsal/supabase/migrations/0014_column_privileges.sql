-- 0014 — which columns a person may write on their own rows.
--
-- Every own-row policy in this schema says *whose* row may be written and
-- nothing about *which columns*. So `profiles_update_own` let anyone run
-- `update profiles set is_admin = true where id = auth.uid()` through the REST
-- API with nothing but the publishable key — and `is_suspended = false`,
-- undoing a moderator. `participants_update_own` let a participant mark
-- themselves `attended`, answer for the host by setting `host_marked`, or move
-- from `waitlist` to `joined` past the plaza held for a newcomer. A host could
-- rewrite `joined_count`, `filled_at` and `created_at`, and set `status` to
-- `cancelled` with no reason, past cancel_plan(). Anyone could insert a
-- `verified` venue, pin their own message by inserting it pinned, backdate a
-- message, or file a report already `actioned` and `resolved_by` a moderator.
--
-- Every one of those was reproduced against the shim before this was written.
-- None is reachable from the app's own code, which writes through security
-- definer functions or sends a fixed set of columns — but the app is not the
-- API surface; PostgREST is, and it takes any column the role may write.
--
-- Postgres has column-level privileges and Supabase's API roles honour them:
-- table-level INSERT and UPDATE are revoked and granted back on exactly the
-- columns the app writes. A request naming any other column is refused with
-- `permission denied` before RLS is consulted. Tables that only functions
-- write become read-only to the API roles, and the two participant UPDATE
-- policies — which had no caller inside the app — go with them.

-- ── profiles ─────────────────────────────────────────────────────────────────
-- dorsal_number and created_at are the database's; is_suspended and is_admin
-- the moderator's; is_seed the seed's. complete_onboarding() and moderate()
-- run as the owner and are unaffected.
revoke insert, update on profiles from anon, authenticated;
grant insert (id, display_name, photo_url, birth_year, gender, distrito, travel_km, bio)
   on profiles to authenticated;
grant update (display_name, photo_url, birth_year, gender, distrito, travel_km, bio, last_active_at)
   on profiles to authenticated;

-- ── plans ────────────────────────────────────────────────────────────────────
-- joined_count and filled_at belong to the counts trigger; status and
-- cancelled_reason to cancel_plan(), moderate() and delete_my_account();
-- series_id to materialise_my_recurring(); is_seed to the seed. What is left
-- is the plan form, exactly.
revoke insert, update on plans from anon, authenticated;
grant insert (host_id, sport, title, starts_at, duration_min, venue_id, meeting_note, distrito,
              level_min, level_max, level_display, capacity, third_half, third_half_venue_id,
              audience, min_plans_required, recurring_rule)
   on plans to authenticated;
grant update (host_id, sport, title, starts_at, duration_min, venue_id, meeting_note, distrito,
              level_min, level_max, level_display, capacity, third_half, third_half_venue_id,
              audience, min_plans_required, recurring_rule)
   on plans to authenticated;

-- ── venues ───────────────────────────────────────────────────────────────────
-- `verified` means a person confirmed the coordinate against a real source.
-- Nobody confirms their own pin.
revoke insert, update on venues from anon, authenticated;
grant insert (name, kind, distrito, lat, lng, is_public, created_by) on venues to authenticated;
grant update (name, kind, distrito, lat, lng) on venues to authenticated;

-- ── messages ─────────────────────────────────────────────────────────────────
-- Pinning is pin_message()'s and created_at is when the row arrived. There has
-- never been an UPDATE policy on messages (decision 25); now there is no
-- UPDATE grant either, so a direct edit is refused rather than matching nothing.
revoke insert, update on messages from anon, authenticated;
grant insert (plan_id, user_id, body) on messages to authenticated;

-- ── reports ──────────────────────────────────────────────────────────────────
-- status, resolution, resolved_at and resolved_by are the moderator's answer,
-- written by moderate(). A report arrives open.
revoke insert on reports from anon, authenticated;
grant insert (reporter_id, subject_user, subject_plan, subject_message, reason, detail)
   on reports to authenticated;

-- ── written only by functions ────────────────────────────────────────────────
-- Membership changes go through join_plan(), leave_plan(), leave_plan_safety(),
-- mark_attendance(), confirm_attendance() and settle_attendance(); reliability
-- and moderation history through the functions that record them. The two
-- participant UPDATE policies had no caller in the app and, it turns out, one
-- caller outside it.
drop policy participants_update_own  on plan_participants;
drop policy participants_update_host on plan_participants;
revoke insert, update, delete on plan_participants  from anon, authenticated;
revoke insert, update, delete on reliability_events from anon, authenticated;
revoke insert, update, delete on moderation_actions from anon, authenticated;

-- ── the counts trigger writes as the owner ──────────────────────────────────
-- Found while reproducing the participant hole. A direct update to one's own
-- row fired sync_plan_counts(), which then updated `plans` as the participant
-- — and plans_update_host let it change nothing, silently. Four rows said
-- joined; the card said three. Every write path that remains runs as the
-- owner already; this makes the trigger's own write independent of who fired
-- it, so the counter cannot drift that way again whatever comes next.
--
-- The body is the live definition from 0008, verbatim (decision 67).
create or replace function sync_plan_counts() returns trigger
language plpgsql security definer set search_path = public as $$
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

-- Postgres re-grants EXECUTE to PUBLIC on a replaced function. See 0009.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  execute on function public_plan_preview(uuid) to anon;
grant  execute on function has_verified_selfie(uuid) to anon;
