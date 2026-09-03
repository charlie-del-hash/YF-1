-- Local-only shim. NOT a migration — never applied to a real Supabase project,
-- where all of this already exists. It recreates just enough of the platform
-- (auth schema, auth.uid(), the anon/authenticated roles, and the JWT claim
-- GUC) for the migrations and the RLS tests to run against a bare Postgres.
create schema if not exists auth;

do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;

-- A cut-down auth.users carrying the columns the seed writes, so the seed file
-- is byte-identical between here and a real Supabase project.
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key default gen_random_uuid(),
  aud                text,
  role               text,
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage on sequences to authenticated;

-- Supabase grants the API roles usage on the auth schema so that auth.uid()
-- is callable from policies and from PostgREST queries. Mirror that here.
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase ships a `supabase_realtime` publication that tables are added to.
-- Created here so the migration's realtime step is exercised locally instead of
-- being skipped and discovered in production.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Enough of Supabase Storage for the bucket policies in 0006 to be exercised
-- rather than skipped. The real schema has far more columns; these are the ones
-- the policies actually read.
create schema if not exists storage;
create table if not exists storage.buckets (
  id     text primary key,
  name   text,
  public boolean not null default false
);
create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets,
  name       text not null,
  owner      uuid,
  created_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated, anon;
