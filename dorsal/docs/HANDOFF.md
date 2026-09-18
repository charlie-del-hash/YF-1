# Handoff

Written at the end of the session that built M0–M4, for whoever picks this up
next. `CLAUDE.md` is still the constitution and carries the numbered decision
log — this file is orientation, not a second source of truth.

## Where things are

- Repo `charlie-del-hash/YF-1`, work branch `claude/coding-session-0hb1m9`, open
  as [PR #1](https://github.com/charlie-del-hash/YF-1/pull/1).
- **`dorsal` is the branch, and it is live.** Work happens directly on it and
  **every push deploys to https://dorsal-chi.vercel.app**. That is the owner's
  explicit choice, made after the first deploy. Treat a push as shipping:
  the full suite passes before it, not after.
  `claude/coding-session-0hb1m9` is the older session branch, kept for history.
- **The app is in `dorsal/`.** The repository root is an unrelated Eleventy
  project that was already there and has not been touched. Every path in
  `CLAUDE.md`, the README and the commit messages is relative to `dorsal/`,
  which has caused confusion once already.
- `main` has none of this.

## What exists

| | |
|---|---|
| **M0** | Magic-link sign in, four-step onboarding with an 18+ gate, the deck (card stack **and** list over one queue), plan detail with map, roster |
| **M1** | Create, edit, cancel and leave plans; waitlist promotion; `Mis planes`; deck filters in the URL |
| **M2** | Group chat, one thread per plan, Supabase Realtime, host pin, 48h close, unread counts |
| **M3** | Palabra: two-sided attendance, the 72h rule, the minimum-plans gate, reserved plazas, the cooldown |
| **M4** | Report and block, the private post-plan check, selfie verification and its queue, moderation with a logged reason, four legal pages, data export and account deletion |

173 unit tests, 61 SQL assertions, 38 e2e. All green at `1a308aa`.

## What does not exist

- **Nobody has walked the live site yet.** It builds and serves, but no one has
  signed in, onboarded and joined a plan on the deployed thing. That is the
  first thing to get done, and it cannot be done from this container.
- **No moderator exists yet**, so `/admin` is a 404 for everybody. The SQL is in
  `docs/DEPLOY.md`.
- **The seed data is still in the live database.** Fine for showing someone,
  wrong the moment a real person joins a plan nobody will turn up to.
- **No web push.** Deferred to M6 by the owner's decision. It needs a
  network-touching dependency, which `CLAUDE.md` says nobody adds without
  asking.
- **No profile photo upload.** Deferred in M0 and still open. The `dorsales`
  bucket and its policies exist and nothing writes to them, so a moderator
  reviewing a selfie has no profile photo to compare it against. This is the
  most load-bearing gap and it is not on the M5 list.
- **M5 and M6.** Under-filled plan rescue, recurring plans, host tools, share
  links, cookieless analytics; then the PWA, install prompt and push.
- **No scheduler**, so the 72-hour attendance rule is settled lazily when
  somebody opens `Mis planes`.

## The live project

Supabase `qplddusqtxmkljoyxdhd`, region `eu-west-1` (Ireland — in the EEA, so
the data-residency requirement holds; `05-RGPD.md` says Frankfurt, and the
difference is deliberate and recorded).

Migrations `0001`–`0007` and `supabase/seed.sql` are all applied.

## How to check anything

```sh
cd dorsal
pnpm typecheck && pnpm lint && pnpm test && pnpm build
./scripts/pgtest.sh          # migrations + RLS + concurrency, no Docker, no cloud
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers pnpm test:e2e
```

`scripts/pgtest.sh` boots a throwaway Postgres with a Supabase shim and runs
everything in `supabase/test/`. Run it before any schema change lands — it is
the only thing standing between a policy edit and a data leak.

`supabase/test/03-remote-check.test.sql` is written to run in the Supabase SQL
editor as well, and is what proves RLS is on in the place that matters. The
owner has run it; all eight checks passed.

## Environment gotchas, learned the hard way

- **This container cannot reach `supabase.co` or `vercel.com`.** An organisation network policy
  blocks both for curl, Node and Chromium alike, and credentials do not help.
  `*.vercel.app` is blocked too, so **the live site cannot be opened from here**
  — not by curl and not by Playwright. Schema changes go through the Supabase
  MCP tools; anything needing to *look* at production goes through the owner or
  a browser-capable session. Git is *not* blocked, which is exactly why pushing
  is the deploy mechanism.
- **Playwright**: the bundled Chromium is a revision Playwright does not know.
  `playwright.config.ts` finds it under `PLAYWRIGHT_BROWSERS_PATH`; run e2e with
  that variable set. Never run `playwright install`.
- **`pnpm test:e2e` reuses a server already on :3000.** If one is left over from
  a manual `pnpm start`, the suite silently tests a stale build. Kill
  `next-server` first. This cost an hour once.
- The Bash tool's working directory resets between calls — prefix with
  `cd /home/user/YF-1/dorsal`.

## How this has been working

Worth keeping, because it has repeatedly paid:

1. **The database is where the rules live.** Capacity, the 12-hour cancellation
   line, who can read a message, who can be seen — all decided in SQL under a
   lock or a policy, with the UI only putting the verdict into Spanish. When a
   rule existed in two places it was deleted from one.
2. **Every safety claim is an assertion in `supabase/test/`.** Not a comment.
   Writing those tests has found real holes: policies granting rows to a
   subject-less session, `plans.host_id` cascading so a deleted account erased
   other people's plans, a test that passed vacuously against nulls.
3. **Screenshot the `/kit` page after building a screen.** It has caught a copy
   bug every single time — `1 filtros`, a mislabelled select, `Después: café en
   Café en Malasaña`, and "Sí, fui" styled as the primary action, which quietly
   nudges people toward the flattering answer in the one place the data has to
   be honest.
4. **Say what is not done.** Every milestone summary has named its gaps. That is
   why the owner could make an informed call on push.
5. The pre-build audit (`compass_artifact…md`) was right about several things
   and was acted on: no OSM tile servers, a level-band marker instead of silent
   dead ends, the gate capped at two, reserved plazas.

## If it were up to me, next

1. **Deploy** (`docs/DEPLOY.md`). Everything else is theory until someone can
   open it on a phone.
2. **Profile photo upload.** It closes the M0 gap and makes verification mean
   something.
3. **M5**, then M6 with push.

And the thing the audit raised that nobody has touched: there is still no
position on **liability and insurance** for a physical injury at a plan. It is
absent from the spec, it is not a code problem, and it is the kind of thing that
wants an answer before real strangers meet in a real park.
