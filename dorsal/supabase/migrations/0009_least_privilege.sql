-- 0009 — who is allowed to call what.
--
-- Every migration so far ended its functions with `grant execute … to
-- authenticated`, which read like a decision and was not one. Postgres grants
-- EXECUTE on a new function to PUBLIC by default, and Supabase's `anon` role
-- inherits PUBLIC, so the real answer to "who can call this" was "anyone
-- holding the anon key" — for all forty-three functions in the schema,
-- including join_plan(), moderate() and delete_my_account().
--
-- Most of that was noise rather than exposure: everything that touches a
-- person's own data opens with `if auth.uid() is null then raise` and refuses.
-- Three read-only helpers did not, because they were written to be called from
-- inside RLS policies and nobody expected them on the API surface. They are
-- guarded below.
--
-- Found by asking the live database who could execute what, rather than by
-- reading the grants that were written. The grants that were written all said
-- `authenticated`.

-- ── the surface ─────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;

-- The one function meant for someone without an account: a share link.
grant execute on function public_plan_preview(uuid) to anon;

-- And this one, not because anon should ask it, but because the
-- public_profiles view puts it in its select list and the view is
-- security_invoker: revoking it turns anon's empty read into an error. It is
-- guarded below instead, which is the part that matters.
grant execute on function has_verified_selfie(uuid) to anon;

-- This was meant to make anything added later start closed. It does not: in
-- Postgres 16, ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM
-- PUBLIC records no row in pg_default_acl and has no effect at all, which was
-- discovered when 0011 added five functions and 08-privileges.test.sql found
-- every one of them open to anon. Left in place because it is harmless and
-- because deleting it would hide the lesson; the thing that actually holds
-- this line is the explicit revoke at the end of each migration, and the test
-- that fails when one is forgotten.
alter default privileges in schema public revoke execute on functions from public;

-- ── the three that answered anyone ──────────────────────────────────────────

/*
 * Who has blocked whom is the most private fact in this product — it is the
 * one thing 01-PRD promises is invisible to the person blocked. This answered
 * for any pair of ids, to anyone.
 *
 * Every caller in the schema passes auth.uid() as one of the two, so requiring
 * that changes no behaviour anywhere and closes the probe.
 */
create or replace function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
     where ((blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a))
       and (select auth.uid()) in (a, b)
  );
$$;

/*
 * The gate count. join_plan() only ever asks it about the caller; asked about
 * anyone else it now answers 0, which fails the gate closed rather than open.
 */
create or replace function completed_plan_count(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from plan_participants
   where user_id = p_user and status = 'attended'
     and p_user = (select auth.uid());
$$;

/*
 * The verified badge is meant to be visible to everyone with an account, and
 * to nobody without one — a stranger should not be able to walk a list of ids
 * asking which of them sent us a photograph of their face.
 */
create or replace function has_verified_selfie(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select auth.uid()) is not null and exists (
    select 1 from verifications
     where user_id = p_user and kind = 'selfie' and status = 'approved'
  );
$$;
