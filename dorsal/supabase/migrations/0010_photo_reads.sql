-- 0010 — who may see a profile photo.
--
-- 0006 made the `dorsales` bucket private and then let any signed-in caller
-- read any object in it. That is nearly right: a profile photo is meant to be
-- visible to people with an account and to nobody else, and the copy on the
-- onboarding screen says exactly that.
--
-- It is wrong in one place that matters. Paths are `<user id>/perfil` and user
-- ids appear on every roster, so anyone who had seen an id could mint a signed
-- URL for that person's face — including someone they had blocked, whose
-- profile the app otherwise refuses to return at all. "You will not see each
-- other" has to include the photograph, or blocking is a filter on lists.
--
-- Comparing `p.id::text` to the folder rather than casting the folder to uuid
-- keeps a junk object name a failed match instead of a cast error, and has the
-- useful side effect that an object not owned by a real profile is unreadable.

drop policy dorsales_read on storage.objects;

create policy dorsales_read on storage.objects for select to authenticated
  using (
    bucket_id = 'dorsales'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.profiles p
       where p.id::text = (storage.foldername(name))[1]
         and not p.is_suspended
         and not public.is_blocked((select auth.uid()), p.id)
    )
  );
