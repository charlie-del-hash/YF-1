-- 0015 — a rejected selfie can be sent again.
--
-- The verification panel submitted with an upsert on (user_id, kind): an
-- INSERT the first time, and an UPDATE of the same row on a retry. The only
-- UPDATE policy on `verifications` is the moderator's, so the retry that
-- `Probar otra vez` offers after a rejection failed with an RLS error — every
-- time, for everyone it was shown to. Reproduced against the shim.
--
-- Submitting is a rule, not a row write: once while a review is pending, never
-- after an approval, and a resubmission has to clear the previous verdict and
-- restart the clock. So it becomes a function, like every other write in this
-- schema that has a rule inside it. The direct INSERT policy goes with the
-- upsert: nothing calls it now, and a policy with no caller is one more thing
-- to keep honest for no reason.
create function submit_selfie(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_status verification_status;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  -- `<own id>/<file>` and nothing else: the storage policy only lets the caller
  -- write inside their own folder, so any other path is a row pointing at
  -- somebody else's object, or at nothing.
  if p_path is null
     or split_part(p_path, '/', 1) <> v_user::text
     or split_part(p_path, '/', 2) = ''
     or split_part(p_path, '/', 3) <> '' then
    raise exception 'bad_path' using errcode = '22023';
  end if;

  select status into v_status from verifications where user_id = v_user and kind = 'selfie';
  if v_status = 'approved' then raise exception 'already_verified' using errcode = '42501'; end if;
  -- The bucket has no update policy for the same reason (0006): a photograph
  -- must not change under the person about to look at it.
  if v_status = 'pending' then raise exception 'already_pending' using errcode = '42501'; end if;

  insert into verifications (user_id, kind, status, selfie_path, submitted_at)
       values (v_user, 'selfie', 'pending', p_path, now())
  on conflict (user_id, kind) do update
       set status        = 'pending',
           selfie_path   = excluded.selfie_path,
           submitted_at  = now(),
           reviewed_at   = null,
           reviewed_by   = null,
           reject_reason = null;
end;
$$;

drop policy verifications_submit on verifications;
revoke insert on verifications from anon, authenticated;

-- Postgres hands EXECUTE on a new function to PUBLIC. See 0009.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  execute on function public_plan_preview(uuid) to anon;
grant  execute on function has_verified_selfie(uuid) to anon;
