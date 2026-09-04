-- Who may call what.
--
-- Postgres hands EXECUTE on every new function to PUBLIC, and `anon` inherits
-- PUBLIC, so a `grant execute … to authenticated` at the bottom of a migration
-- proves nothing about who can actually call it. This asks the catalogue
-- instead of reading the grants, which is how the hole in 0009's comment was
-- found in the first place.

create or replace function test_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end;
$$;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'g1@test.invalid'),
  ('00000000-0000-0000-0000-0000000008a2', 'g2@test.invalid'),
  ('00000000-0000-0000-0000-0000000008a3', 'g3@test.invalid');
insert into profiles (id, display_name, birth_year, distrito) values
  ('00000000-0000-0000-0000-0000000008a1', 'G1', 1990, 'Centro'),
  ('00000000-0000-0000-0000-0000000008a2', 'G2', 1990, 'Centro'),
  ('00000000-0000-0000-0000-0000000008a3', 'G3', 1990, 'Centro');

-- G2 has blocked G3. G1 is a stranger to both.
insert into blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000008a2', '00000000-0000-0000-0000-0000000008a3');

-- ── 1. the anon API surface is exactly the share link ───────────────────────
do $$
declare v_open text[];
begin
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into v_open
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype::oid
     -- The harness's own helper, created by these test files and never by a
     -- migration. Excluded by name so a real function can never hide behind it.
     and p.proname <> 'test_as'
     and has_function_privilege('anon', p.oid, 'execute');

  -- public_plan_preview is the share link. has_verified_selfie is only here
  -- because public_profiles is a security_invoker view that calls it, and it
  -- refuses to answer without a session anyway — assertion 4.
  assert v_open = array['has_verified_selfie','public_plan_preview'],
    'anon can execute: ' || array_to_string(v_open, ', ');
  raise notice 'ok  a caller with no account can reach exactly the share link';
end $$;

-- ── 2. the block graph is not a public lookup ───────────────────────────────
set role authenticated;
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000008a2');
  assert is_blocked('00000000-0000-0000-0000-0000000008a2',
                    '00000000-0000-0000-0000-0000000008a3'),
    'the person who blocked cannot see their own block';

  perform test_as('00000000-0000-0000-0000-0000000008a3');
  assert is_blocked('00000000-0000-0000-0000-0000000008a3',
                    '00000000-0000-0000-0000-0000000008a2'),
    'a block stopped working from the blocked side';

  -- The point of the guard: a third party asking about two other people.
  perform test_as('00000000-0000-0000-0000-0000000008a1');
  assert not is_blocked('00000000-0000-0000-0000-0000000008a2',
                        '00000000-0000-0000-0000-0000000008a3'),
    'a stranger can read the block graph';
  raise notice 'ok  only the two people in a block can see it';
end $$;

-- ── 3. the gate count is about you ──────────────────────────────────────────
do $$ begin
  perform test_as('00000000-0000-0000-0000-0000000008a1');
  assert completed_plan_count('00000000-0000-0000-0000-0000000008a2') = 0,
    'someone else''s plan count is readable';
  raise notice 'ok  the gate count answers about the caller and nobody else';
end $$;

-- ── 4. the verified badge needs a session ───────────────────────────────────
do $$ begin
  perform test_as(null);
  assert not has_verified_selfie('00000000-0000-0000-0000-0000000008a1'),
    'verification status is readable without a session';
  raise notice 'ok  the verified badge is not readable without an account';
end $$;

-- ── 5. and the policies still work for people who are signed in ─────────────
-- The blanket revoke could have taken EXECUTE away from a helper that an RLS
-- policy calls, which would turn every read into a permission error rather
-- than an empty result. One read of each shape is enough to catch that.
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-0000000008a1');
  select count(*) into n from profiles;         -- is_blocked, is_admin
  assert n > 0, 'a signed-in person cannot read profiles any more';
  select count(*) into n from public_profiles;  -- has_verified_selfie
  assert n > 0, 'a signed-in person cannot read public_profiles any more';
  select count(*) into n from plans;            -- can_see_plan, viewer_is_mujer
  assert n >= 0, 'a signed-in person cannot read plans any more';
  raise notice 'ok  signed-in reads still evaluate their policy helpers';
end $$;

-- ── 6. a blocked person's photo is not readable either ──────────────────────
-- Paths are `<user id>/perfil` and ids are on every roster, so a bucket-wide
-- read policy would let anyone who had seen an id fetch the face of someone
-- who had blocked them.
do $$
declare n int;
begin
  reset role;
  insert into storage.objects (bucket_id, name, owner) values
    ('dorsales', '00000000-0000-0000-0000-0000000008a2/perfil',
     '00000000-0000-0000-0000-0000000008a2'),
    ('dorsales', 'no-es-un-perfil/perfil', null);
  alter table storage.objects enable row level security;
  set role authenticated;

  perform test_as('00000000-0000-0000-0000-0000000008a1');
  select count(*) into n from storage.objects
   where name = '00000000-0000-0000-0000-0000000008a2/perfil';
  assert n = 1, 'someone with an account cannot see a profile photo';

  -- G2 blocked G3 in the fixtures above.
  perform test_as('00000000-0000-0000-0000-0000000008a3');
  select count(*) into n from storage.objects
   where name = '00000000-0000-0000-0000-0000000008a2/perfil';
  assert n = 0, 'a blocked person can still fetch the face that blocked them';

  perform test_as('00000000-0000-0000-0000-0000000008a1');
  select count(*) into n from storage.objects where name = 'no-es-un-perfil/perfil';
  assert n = 0, 'an object not owned by a profile is readable';

  perform test_as(null);
  select count(*) into n from storage.objects where bucket_id = 'dorsales';
  assert n = 0, 'profile photos are readable without a session';
  raise notice 'ok  a photo is for people with an account, minus the ones who blocked you';
end $$;

reset role;
rollback;
