-- 0006 — the two buckets, and who may touch what in them.
--
-- Both are private. A profile photo is a picture of someone's face attached to
-- a name and a district; making it world-readable so that rendering is one line
-- easier is not a trade this product gets to make. Reading goes through signed
-- URLs minted server-side for signed-in users.

insert into storage.buckets (id, name, public) values
  ('dorsales', 'dorsales', false),
  ('verificaciones', 'verificaciones', false)
on conflict (id) do nothing;

-- Paths are `<user id>/<file>`, which is what makes ownership checkable.
create policy dorsales_read on storage.objects for select to authenticated
  using (bucket_id = 'dorsales' and (select auth.uid()) is not null);

create policy dorsales_write_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dorsales'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy dorsales_update_own on storage.objects for update to authenticated
  using (bucket_id = 'dorsales' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy dorsales_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'dorsales' and (storage.foldername(name))[1] = (select auth.uid())::text);

/*
 * Verification selfies are the most sensitive thing this product ever holds,
 * and 05-RGPD §2 is the reason the design is what it is: a person compares two
 * photographs, which is not biometric processing, whereas an algorithm doing it
 * is Article 9 data and a different legal project entirely.
 *
 * So: only the person who uploaded it and a moderator can read one, nobody can
 * read anyone else's, and moderate('approve_selfie'|'reject_selfie') clears the
 * path the moment a decision is made. The object itself is deleted by the same
 * server action; this policy is what stops it being readable in the meantime.
 */
create policy selfies_read_own_or_admin on storage.objects for select to authenticated
  using (
    bucket_id = 'verificaciones'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or is_admin())
  );

create policy selfies_write_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verificaciones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy selfies_delete_own_or_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'verificaciones'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or is_admin())
  );

-- No update policy on verificaciones at all: a selfie is submitted once and
-- then reviewed. Replacing the bytes under a pending review would be a way to
-- get a different photograph approved than the one a person looked at.
