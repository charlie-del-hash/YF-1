# CLAUDE.md — Dorsal

Repo constitution. Read this first, every session. If a decision here changes, edit this file in the same commit as the change.

## What this is

A mobile-web app for Madrid where people find a sports plan (a *quedada*) near them, join it, and meet the group afterwards for a coffee or a caña. Working codename **Dorsal**. Spanish market, Spanish UI, Madrid-only at launch.

The user swipes on **plans**, never on people. There is no 1:1 matching with strangers. Chat exists only inside a plan.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Server Components by default; `"use client"` only where interaction demands it |
| Styling | Tailwind CSS + CSS custom properties for tokens | Tokens live in `app/globals.css`, defined once, referenced everywhere |
| DB / Auth / Realtime / Storage | Supabase, **EU region (Frankfurt)** | RLS on from the first table, no exceptions |
| Auth method | Email magic link (v1). Phone OTP behind `NEXT_PUBLIC_FEATURE_PHONE_AUTH` | Phone costs money and needs a Twilio account; don't wire it without asking |
| Maps | MapLibre GL JS + OSM-based free tiles | No Google Maps in v1 (billing + extra data processor) |
| Gestures | Framer Motion for the swipe deck | Must work with touch, mouse, and keyboard (arrow keys) |
| Hosting | Vercel | Preview deploy per branch |
| Package manager | pnpm | |
| Tests | Vitest (units, domain logic) + Playwright (one happy-path e2e per milestone) | Test the reliability/attendance rules properly — that logic is the product |

Nothing else gets added without asking. Every new dependency that talks to a network is a GDPR question, not just a bundle-size question.

## Directory shape

```
app/                  routes (App Router)
  (auth)/             sign in, callback
  (app)/              authed shell: deck, plan, chats, profile
  api/                route handlers where a server action won't do
components/           dumb UI; no data fetching
features/             feature slices: plans/, deck/, chat/, profile/, reliability/
  <feature>/
    actions.ts        server actions
    queries.ts        data access
    schema.ts         zod schemas
    *.tsx             feature components
lib/
  supabase/           server + browser clients
  copy/es-ES.ts       EVERY user-facing string, single dictionary
  levels.ts           per-sport level scales + formatting
  time.ts             all date/time in Europe/Madrid
supabase/
  migrations/         numbered SQL migrations
  seed.sql            generated from seed-madrid.json
```

## Non-negotiable rules

1. **No hardcoded user-facing strings.** They all go in `lib/copy/es-ES.ts`. If you write a Spanish string inline in a component, that's a bug.
2. **RLS on every table, written in the same migration as the table.** A table without a policy is a data leak. Test policies with an anonymous client, not just the service key.
3. **All times are `timestamptz` and rendered in `Europe/Madrid`.** Spain switches to CEST; don't do date maths in local strings.
4. **Locations are public meeting points only.** Never store or display a user's precise location. Users have a *distrito*, not an address.
5. **The service-role key never reaches the client.** Server-side only, never in a `NEXT_PUBLIC_` var.
6. **No flirty copy, no romantic framing, no dating-app iconography.** See `03-DESIGN-BRIEF.md`.
7. **Attendance rules live in one module** (`features/reliability/`) and are unit-tested. Don't scatter them.
8. **18+ only.** Age gate at signup, stored, enforced.
9. Currency `EUR`, decimal comma in display (`12,50 €`), 24-hour clock (`19:30`), week starts Monday.
10. Accessibility floor: visible keyboard focus, `prefers-reduced-motion` respected, the swipe deck fully operable without gestures, contrast ≥ 4.5:1 on text.

## Commands

```bash
pnpm dev              # local dev
pnpm build            # production build — must pass before any milestone is "done"
pnpm lint             # eslint
pnpm format           # prettier --check
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm db:seed:gen      # seed-madrid.json -> supabase/seed.sql
pnpm db:push          # apply migrations to the linked Supabase project
pnpm db:reset         # local reset + migrate + seed
./scripts/pgtest.sh   # migrations + RLS + concurrency, against a throwaway Postgres
```

`scripts/pgtest.sh` needs no Supabase project and no Docker: it boots a local
Postgres, applies `supabase/test/00-supabase-shim.sql` (which recreates the
`auth` schema, `auth.uid()` and the API roles), then the migrations, the seed
and the assertions in `supabase/test/`. Run it before every schema change lands
— it is the only thing standing between a policy edit and a data leak.

## Definition of done (every milestone)

- `pnpm typecheck && pnpm lint && pnpm build && pnpm test` all pass
- The new happy path works on a 390px-wide viewport with a thumb, not just a mouse
- RLS verified for any new table by querying as an anon and as a non-owner user
- No new user-facing string outside the copy dictionary
- Empty, loading and error states exist for every new screen — not "TODO"
- One commit per slice, message explains the *why*
- `CLAUDE.md` updated if a decision changed

## Working style

- Plan before building. Show the plan, wait for approval, then build.
- When the spec is wrong, say so and propose the fix. Don't silently implement something worse.
- Prefer deleting code to adding flags.
- When you're unsure whether something is a v1 concern, check `01-PRD.md`'s out-of-scope list before asking.

## Glossary (use these words in code and UI)

| Term | Meaning |
|---|---|
| **quedada / plan** | A scheduled sports session someone can join. The core object. |
| **dorsal** | A user's profile. Numbered like a race bib. |
| **Palabra** | Reliability score based on attendance. |
| **tercer tiempo** | What the group does after the sport: café, caña, brunch, or nothing. |
| **anfitrión/a** | The person who created the plan and confirms attendance. |
| **plazas** | Remaining spots in a plan. |
| **nivel** | Skill/pace level, scale differs per sport. |


---

## Decisions taken or changed while building M0

Recorded here rather than in a commit message, per the rule at the top of this
file. Each one is a deviation from the attached spec, with its reason.

**1. The 18+ rule is a trigger, not a CHECK constraint.** `02-DATA-MODEL`
specifies `check (birth_year <= extract(year from now()) - 18)`. Postgres
rejects that: CHECK expressions must be immutable and `now()` is not. The rule
is enforced by `enforce_adult()` on insert and on update of `birth_year`, and
tested in `supabase/test/01-rls.test.sql`.

**2. The profile row is created at the end of onboarding, not by a signup
trigger.** `display_name`, `distrito` and `birth_year` are NOT NULL and are only
collected during onboarding, so a trigger-created row would need placeholders —
and a placeholder profile is indistinguishable from a real one on a plan roster.
"No profile row" is the honest representation of "signed up, hasn't onboarded",
and it is what every redirect in the app keys off.

**3. Read policies require a JWT subject.** Writing the RLS tests showed that a
session holding the `authenticated` role with no subject could read every
`todos` plan. PostgREST should never produce that state, but "should never
happen" is not an access control. Every read policy now begins with
`(select auth.uid()) is not null`.

**4. `blocks` ships in migration 0001**, ahead of the M4 slot in the build plan,
because the `profiles` and `plans` read policies are written in terms of it.

**5. The deck has a list view as well as a card stack.** Same queue, same
`Me apunto`, same server action. The card stack is the briefed interaction; the
list is there because the swipe deck's premise — abundant, interchangeable,
always-available inventory — does not describe sports plans, which are scarce,
perishable and constrained by time, place and level. The design brief already
requires the deck to work without gestures, so this costs almost nothing and
turns an argument into something two users can be shown. The preference is
remembered per device.

**6. Map tiles come from a configured provider, never `tile.openstreetmap.org`.**
The OSMF tile usage policy prohibits application use and says access will be
withdrawn without notice, so the "free OSM tiles" line in the stack table is an
outage with a delay on it. `NEXT_PUBLIC_MAP_STYLE_URL` points at any
MapLibre-compatible EU provider (MapTiler, Stadia, Jawg, Protomaps). With no key
set, the plan detail degrades to the venue name plus a directions link instead
of a grey box.

**7. The deck sorts by distrito, it does not filter by kilometres.** A viewer
has a distrito and never coordinates (`05-RGPD` §3), so "within `travel_km`"
cannot be computed without Madrid's distrito boundaries. Until those are loaded
from a real source, own-distrito plans sort first and the rest follow by start
time. The slider is stored and honoured as intent; it is not yet a radius, and
the code says so where it happens.

**8. The 12–24h cancellation window is free.** `02-DATA-MODEL` leaves the exact
rule to be decided. Someone cancelling 18 hours out has given the host most of a
day to refill the plaza, and penalising that teaches tentative newcomers — the
primary user — not to join in the first place. The falta starts under 12 hours,
where a plaza realistically cannot be refilled. In `lib/time.ts`, tested.

**9. Seed plans are emitted as a whole-week offset computed at apply time**,
rather than as the fixed September dates in `seed-madrid.json`. Fixed dates
produce an empty deck the moment that week passes, and `plans.future_start`
rejects the insert outright. Shifting by whole weeks keeps weekdays and times
intact — the Sunday pachanga stays on Sunday.

**10. `@supabase/ssr` is on 0.12.x, not 0.5.x.** The older release's generics
do not line up with supabase-js 2.114, which silently degraded every typed
`rpc()` argument to `undefined`.

**11. Not yet built after M0, and deliberately:** the photo upload in onboarding
(the field is present and explained; storage bucket policies are their own
slice), chat, Palabra, report/block UI.

---

## Decisions taken or changed while building M1

**12. `reliability_events` ships in migration 0002**, ahead of its M3 slot, for
the same reason `blocks` came early: `leave_plan()` has to record what a
cancellation cost at the moment it happens, and that is not reconstructable
afterwards. The table and its RLS are here; the derived view, the display and
the gates are still M3.

**13. The 12-hour rule exists once, in SQL.** `leave_cost()` is the only
definition, and the plan screen asks it rather than working the answer out in
the browser, so the sentence someone agrees to on the confirmation and the row
written to their history cannot disagree. `cancellationCost()` was deleted from
`lib/time.ts` for this reason — a second implementation of a rule is a second
answer waiting to happen.

**14. `solo mujeres` plan creation ships in M1**, ahead of its M4 slot. The RLS
policy, the deck filter and the invisibility tests already existed after M0, so
a create form that could not produce the one plan type the filter offers would
have been incoherent. Creation is gated on the host having declared `mujer`, in
the server action and against the same column the read policy keys off. What is
still M4: the report/block UI, selfie verification and the moderation queue.

**15. Cancelling a plan does not notify anyone yet.** The reason is required by
the database and surfaced on the plan and in `Mis planes`, and the form says in
as many words that the host still has to tell the group. Web push is M2;
pretending otherwise would be worse than the sentence admitting it.

**16. Filters live in the URL, not in component state.** A filtered deck can
then be shared, bookmarked and reloaded, and the filters are applied to the
query rather than fetched-then-hidden. The `Nivel` filter is `Mi nivel`
(default) or `Todos los niveles`; plans outside the viewer's band are marked
`Fuera de tu nivel` on the card, because `join_plan()` will refuse them and a
deck full of silent dead ends is worse than one that says so.

**17. `min_plans_required` is not in the create form.** The column, the gate and
its test exist, but hosts cannot set it until M3 ships the reserved-plaza rule
for newcomers alongside it. A gate without the escape hatch is the catch-22 the
audit warned about.

**18. Native date and time inputs render in the browser's UI language**, which a
page cannot set — so the create form echoes the chosen moment back in Spanish
(`sábado, 12 de septiembre · 19:30`). That also confirms the Madrid instant the
host actually picked, which is the part that would otherwise be invisible.


---

## Deployment notes

**The project.** `qplddusqtxmkljoyxdhd`, region **`eu-west-1` (Ireland)**, not
Frankfurt as the stack table says. Ireland is in the EEA, so the requirement
that actually matters — user data does not leave the EEA without a transfer
basis — holds. Recorded here rather than silently: `05-RGPD.md` names Frankfurt,
and anyone auditing this later should not have to wonder whether the difference
was noticed.

**Applied so far:** migrations `0001_init` and `0002_plan_lifecycle`, and
`supabase/seed.sql`.

**Verifying a deployment.** `supabase/test/03-remote-check.test.sql` is written
to run in the Supabase SQL editor as well as under `scripts/pgtest.sh`, so the
script is known to work before it is pasted anywhere. It is the only thing that
proves RLS is on in the place it matters — a local pass says nothing about the
remote project.

**The seed applies through any client.** It used to create a temporary table to
hold the week-offset, which does not survive a stateless SQL call; it now
defines and drops a function instead, so the same file works through psql, the
Supabase CLI and the management API.

**Still not done:** the Vercel deploy. It needs the two `NEXT_PUBLIC_` variables
and an Auth redirect allow-list entry for `<site>/auth/callback`; without the
latter, magic links fail in a way that looks like an expired link.
