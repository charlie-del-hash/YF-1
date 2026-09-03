# Dorsal

Quedadas deportivas en Madrid: you find a plan you'll actually show up to, and
the people you'll get a coffee with afterwards.

Working codename. The product spec, data model, design brief, build plan and
compliance floor are the `0*.md` files this was built from; `CLAUDE.md` is the
repo constitution and carries the running list of decisions that have changed.

**Status: M0.** Sign in → onboarding → deck → `Me apunto` → on the roster.
Plan creation, chat, Palabra and the trust-and-safety surfaces are M1–M4.

## Run it

```sh
pnpm install
cp .env.example .env.local     # fill in a Supabase project in the EU region
pnpm dev                       # http://localhost:3000
```

Without a Supabase project the app still builds and runs; every authed route
redirects to the sign-in screen, and `/kit` renders the component reference from
fixed sample data.

## Checks

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # must all pass
./scripts/pgtest.sh                                      # migrations, RLS, concurrency
pnpm test:e2e                                            # happy path, phone viewport
```

`scripts/pgtest.sh` is the important one. It needs no Supabase project and no
Docker — it boots a throwaway Postgres, recreates just enough of the Supabase
platform (`auth` schema, `auth.uid()`, the API roles), applies every migration
and the seed, and then asserts the things the product promises:

- anonymous callers see nothing;
- `solo mujeres` plans are invisible to everyone else through every query path,
  including by direct id and via the roster;
- blocked pairs disappear from each other's profiles, plans and rosters;
- `public_profiles` cannot leak gender, birth year or moderation state;
- every gate in `join_plan()` refuses for the right reason;
- twelve concurrent sessions cannot take three plazas more than three times;
- the 18+ floor holds at the database, not just at the form.

Run it before any schema change lands.

## The database

```sh
pnpm db:seed:gen    # supabase/seed-madrid.json -> supabase/seed.sql
pnpm db:push        # apply migrations to the linked project
```

Seeded rows all carry `is_seed = true` and are meant to be deleted as real
supply arrives:

```sql
delete from plans where is_seed; delete from profiles where is_seed;
```

Seeded venues carry `verified = false`: their coordinates were written from
general knowledge and must be confirmed against a real source — OpenStreetMap,
the club's own site, the Ayuntamiento's facilities directory — before anyone is
told to meet there. The UI labels them until then.

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The project. EU region (Frankfurt). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, unused in M0. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | A MapLibre style from an EU tile provider. Not OSM's own tile servers — their usage policy forbids application use and access is withdrawn without notice. With this unset, plan detail shows the venue and a directions link instead of a map. |
| `NEXT_PUBLIC_SITE_URL` | Where magic links come back to. |

`vercel.json` pins functions to `fra1`; Vercel does not default to an EU region,
and the whole data-protection position depends on that being explicit.

## Layout

```
app/            routes. (app)/ is the authed shell; /kit is the component reference
components/     presentational only, no data fetching
features/       auth/, onboarding/, deck/, plans/ — actions, queries, schemas, components
lib/
  copy/es-ES.ts every user-facing string, and the test that keeps it that way
  levels.ts     per-sport level scales, in one place, in both directions
  time.ts       everything in Europe/Madrid
  supabase/     server, browser and middleware clients
supabase/
  migrations/   numbered SQL; every table's RLS in the same file as the table
  test/         the shim, the RLS assertions, the concurrency test
scripts/        seed generation, the Postgres harness
docs/           the design pass: tokens, the critique, and what it changed
```
