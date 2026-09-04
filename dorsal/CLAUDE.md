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

## Decisions taken or changed while building M2

**23. `chat_reads` is its own table.** Unread state could have been a column on
`plan_participants`, except the host has no participant row — `join_plan()`
refuses the host of a plan — and a host with no unread count for their own plan
is the kind of special case that becomes a bug. One table keyed on (user, plan)
covers everyone.

**24. Blocks apply to the thread, not just the roster.** "You will not see each
other" has to include the chat, or blocking someone you share a plan with
achieves nothing. Whether a block should eject one of them from the shared plan
outright is a real question and it is M4's.

**25. There is no UPDATE policy on `messages` at all.** No edits, because a
message someone has acted on must not change under them; deleting your own
within five minutes covers autocorrect and the wrong-window case. Pinning is
therefore a `security definer` function rather than a column write, which is
also what stops a message's author pinning themselves.

**26. "Auto-archives (read-only, then hidden)" is implemented as read-only.**
The chat stops accepting writes 48h after the plan ends and stays readable —
what the group agreed about the meeting point is worth keeping. There is no
separate chat list to hide a thread from in v1; a thread lives inside its plan,
so "hidden" has nothing to mean yet. Revisit if a chat list ever exists.

**27. Web push is NOT built, and this is the honest gap in M2.** It needs a
network-touching dependency (`web-push` or equivalent) to sign VAPID and encrypt
payloads, a `push_subscriptions` table, a service worker, and a deployed origin
over HTTPS to test against — none of which can be verified from a container that
cannot reach the internet. Rule 1 of the stack table also says no new dependency
that talks to a network gets added without asking, and a push endpoint is a
third party receiving a user identifier, so it is a `05-RGPD` question as well
as a bundle one. Unread counts are in and visible on `Mis planes` and the plan;
the notification that makes them arrive without opening the app is the piece
still missing, and the audit's point about iOS PWA push stands: it only works
once the app is installed to the Home Screen, which is M6.

---

## Decisions taken or changed while building M3

**28. The minimum-plans gate is capped at two, in the database.** 02-DATA-MODEL
allows up to ten. The pre-build audit is right that this is a catch-22: the
people most likely to be gated out are exactly the ones 01-PRD names as the
primary user — someone who has just moved to Madrid and has no history anywhere.
Two filters drive-by joins and clears in two weekends.

**29. One plaza on an ungated plan is held for someone with no history.** The
gate alone was never enough: an ungated plan that fills with regulars is just as
closed to a newcomer as a gated one. On plans with `min_plans_required = 0` and
capacity ≥ 4, an established user who arrives for the last plaza is
**waitlisted, not refused** — the plaza opens to them if no newcomer takes it.
Below capacity 4 nothing is reserved, because one plaza is then a quarter of
the group.

**30. Palabra cannot render a score at anyone.** `features/reliability/palabra.ts`
produces one of three strings and by construction cannot produce a rank, a
badge, a colour or a comparison. The case that decided its shape: someone who
committed and did not turn up. "Nuevo por aquí" would be a lie, and
`0 planes · 0% asistencia` is the most public shaming this product could do, so
they read as `Todavía sin planes` — true, and not a verdict. A future screen
wanting "top hosts this month" has to go around this module, and that should be
a conversation rather than a commit.

**31. Both attendance answers are weighted the same.** `Sí, fui` was styled as
the primary action and `Al final no pude` as secondary, which nudges people
toward the answer that flatters them — in the one place in the product where the
data has to be honest rather than encouraging. Both are secondary now.

**32. Settlement is lazy, because there is no scheduler.** The 72-hour rule is
applied by `settle_my_overdue_plans()` when someone who was in the plan opens
`Mis planes`. It is idempotent and cheap. A cron would do this properly and
should, once there is somewhere to run one; until then a record cannot sit
unresolved for ever just because nobody ran anything.

**33. A disagreement penalises nobody and is logged.** Three `disputed` events
is the threshold 01-PRD sets for a human to look, and the queue that human works
from is M4's. The data is being collected now so the queue has something to show
when it exists.

**34. The cooldown closes the full plans, not the product.** Two faltas in
thirty days means no joining plans already at 80% capacity — the ones where
someone would be left standing. Everything emptier stays open, which is what
makes it a cooldown rather than a ban.

---

## Decisions taken or changed while building M4

**35. Blocking ejects nobody.** The case that matters is blocking someone you
are about to stand in a park with, and both obvious answers are wrong. Ejecting
the blocked person is weaponisable — block a rival, free a plaza, remove someone
from a plan they committed to — and it tells them they were blocked. Doing
nothing leaves two people who cannot see each other turning up to the same
meeting point. So `block_user()` returns the upcoming plans now shared and the
blocker decides for themselves; `leave_plan_safety()` makes that exit free,
because 01-PRD's own copy says "sal del plan sin dar explicaciones".

**36. A deleted account leaves the plan and the conversation standing.** The
test caught this: `plans.host_id` cascaded, so deleting an account deleted every
plan that account had hosted, and with them the roster and the whole chat, for
everyone else who had been there. Both foreign keys are now `on delete set
null`, and 0007 cancels the host's future plans first so people find out.
Messages keep their words and lose their author, which is the decision 05-RGPD
§5 asks to be made in advance, and the privacy policy says so in as many words.

**37. There is no cookie banner, and the cookies page explains why precisely.**
The only client storage is the Supabase session cookie and one UI preference the
user chose themselves (cards or list), both exempt. A banner where there is
nothing to consent to trains people to dismiss banners. The page also commits to
what happens the day that changes: reject exactly as easy as accept.

**38. The legal pages are drafts, and say so on the page.** The operator's
identifying details are visible `[PLACEHOLDERS]` rather than invented — a
plausible-looking fake NIF would be worse than an obvious gap. 05-RGPD is right
that a Spanish abogado has to review these; what is done here is the useful
half, which is writing down the decisions the code actually makes.

**39. Verification is manual, and the schema cannot become otherwise by
accident.** Nothing in it compares two images. The selfie is a path to a private
object, `moderate()` clears that path in the same statement as the decision, the
server action deletes the bytes, and only the badge survives. 05-RGPD §2 is the
reason: a person comparing two photographs is not biometric processing, and an
algorithm doing it is Article 9 data with a DPIA attached.

**40. Every moderation action carries a typed reason and is logged in the same
transaction.** A moderation log without a why is not a log, it is a list of
things that happened to people.

**41. `/admin` is a 404 for everyone else, not a 403.** Someone who is not a
moderator has no business learning the screen exists, and its contents are the
most sensitive rows in the database.

**42. The post-plan check is asked once per plan and never by the host.** Asking
after every plan trains people to tap through it, which destroys the value of
the rare "no"; and the promise that the host cannot see it is on the screen,
because that is what decides whether anyone says anything at all.

**43. Still outstanding: profile photo upload.** It was deferred in M0 and is
still deferred. The `dorsales` bucket and its policies exist, but nothing
uploads to it — which means a reviewer comparing a selfie against a profile
photo currently has nothing to compare it to, and verification only confirms
that a real person took a selfie. This is the next thing worth doing, and it is
not on the M5 list. **Resolved after M5 — see decision 51.**

---

## Decisions taken or changed while building M5

**44. Time-to-fill is a stamped column, not a derived number.** It is
reconstructable from the participant history right up until someone leaves the
plan, and then it is gone. `plans.filled_at` is written by the counts trigger
the first time a plan reaches capacity and is never rewritten — dropping below
capacity again does not reset it, because the question is "how long did this
take to fill", not "is it full now". `fill_metrics()` reads it, is
moderator-only, and excludes seed plans.

**45. Measuring the product needed no analytics vendor.** M5's definition of
done is that median time-to-fill is *measurable*, and four numbers computed in
Postgres from rows already kept answers it. Adding a third-party analytics SDK
would have been a new processor receiving every user's behaviour (`05-RGPD` §1)
to learn something the database already knows. If a vendor is ever proposed, it
is a conversation before it is a commit.

**46. Recurring means weekly, and nothing else.** `recurring_rule` existed from
0001 and was unused. A full RRULE is more than any host here has asked for; the
thing they have is a fixed weekly session. A check constraint refuses anything
but `'weekly'`, and occurrences share a `series_id` so "the Sunday pachanga" is
one thing with a history rather than forty unrelated rows.

**47. The next occurrence is created lazily, when the host opens `Mis
planes`.** Same reason as attendance settlement (decision 32): there is no
scheduler in this project. `materialise_my_recurring()` is idempotent — a
series that already has a future occurrence gets nothing — and catches up if
the host has been away for weeks. Copying a plan never inherits the weekly
flag, so a host who duplicates a fixed session gets one more occurrence rather
than a second series rolling forward beside the first.

**48. The rescue list is the only query that reaches past a left swipe.**
01-PRD asks for exactly this, and the justification is narrow: passing on one
Tuesday run is not a standing instruction about running, and the plan being
short of people two days out is new information. It stays honest by never
reaching past a *right* swipe or an existing membership, only returning people
whose level actually fits, and never showing a `solo mujeres` plan to anyone
who cannot see it. It appears in exactly one place — the end of the deck, where
there is nothing else to show and the second look is earned.

**49. A share link is the only page that renders without a session, and the
database decides what it may say.** `public_plan_preview()` refuses
`solo_mujeres` plans outright rather than filtering them, because a URL
travels; and it returns no roster, no coordinates and no meeting note. The page
does no filtering of its own — there is nothing left to filter. `/p/:id` is
open in the middleware for the same reason: the gate would turn a shared plan
into a sign-in wall, which is the opposite of what a share link is for.

**50. `anon` could execute every function in the schema, and now executes
one.** Postgres grants EXECUTE on a new function to PUBLIC, and Supabase's
`anon` inherits PUBLIC — so every `grant execute … to authenticated` written in
migrations 0001–0008 read like a decision and was not one. Most of it was noise
rather than exposure (anything touching a person's own data opens by refusing a
null `auth.uid()`), but three read-only helpers written for use inside RLS
policies answered anyone who asked: `is_blocked()` exposed the block graph for
any pair of ids, `completed_plan_count()` anyone's attendance count, and
`has_verified_selfie()` whether a given id had sent us a photograph of their
face. Migration 0009 revokes the lot, grants back deliberately, guards those
three, and sets default privileges so the next function starts closed.
`supabase/test/08-privileges.test.sql` pins the anon-executable set to exactly
what it should be, by asking the catalogue rather than reading the grants —
which is how this was found in the first place.

**51. The profile photo exists now, and it is a path rather than a URL.** It
was deferred twice (decisions 11 and 43) while the onboarding copy went on
promising it — "puedes añadirla luego" under no control at all, which a
walkthrough of the live deploy caught. `dorsales` stays private, so
`profiles.photo_url` holds `<user id>/perfil` and every render mints a
short-lived signed URL, batched per roster. The column keeps its misleading
name; `features/profile/schema.ts` refuses anything that is not that exact
shape, and a test says why — validating it as a URL would accept a link to
somebody else's server and turn every profile render into a request to it.

**52. Blocking now covers the photograph.** 0006 let any signed-in caller read
any object in `dorsales`, and paths are `<user id>/perfil` with ids visible on
every roster — so anyone who had seen an id could fetch the face of someone who
had blocked them, while the app refused to return that profile at all. 0010
narrows the read to objects owned by a profile that is neither suspended nor in
a block with the viewer. Found while building decision 51: a bucket-wide read
policy is fine right up until the path is predictable.

---

## Deployment notes

**The project.** `qplddusqtxmkljoyxdhd`, region **`eu-west-1` (Ireland)**, not
Frankfurt as the stack table says. Ireland is in the EEA, so the requirement
that actually matters — user data does not leave the EEA without a transfer
basis — holds. Recorded here rather than silently: `05-RGPD.md` names Frankfurt,
and anyone auditing this later should not have to wonder whether the difference
was noticed.

**Applied so far:** migrations `0001_init`, `0002_plan_lifecycle`, `0003_chat`,
`0004_palabra`, `0005_safety`, `0006_storage`, `0007_data_rights`,
`0008_fill_the_deck`, `0009_least_privilege` and `0010_photo_reads`, and
`supabase/seed.sql`.

**Making the first moderator.** Nothing in the app grants the flag, on purpose:
`update profiles set is_admin = true where id = '…';` in the SQL editor, once.

**Realtime.** `messages` is added to the `supabase_realtime` publication by
0003, guarded so it is a no-op where that publication does not exist. Supabase
filters Realtime through the same RLS policies as a query, so a non-participant
is not subscribed to anything rather than being sent rows and asked not to look.
The audit's warning about Realtime on RLS-filtered tables at scale is real but
is a problem at thousands of concurrent sockets, not at launch.

**Verifying a deployment.** `supabase/test/03-remote-check.test.sql` is written
to run in the Supabase SQL editor as well as under `scripts/pgtest.sh`, so the
script is known to work before it is pasted anywhere. It is the only thing that
proves RLS is on in the place it matters — a local pass says nothing about the
remote project.

**The seed applies through any client.** It used to create a temporary table to
hold the week-offset, which does not survive a stateless SQL call; it now
defines and drops a function instead, so the same file works through psql, the
Supabase CLI and the management API.

**Auth redirect allow-list.** Every entry is a host Supabase will hand a live
session token to. `https://*.vercel.app/**` is therefore not an option, however
convenient it looks for preview deploys — it names every site on the domain.
Scope previews to the team slug or list production exactly.

**Live at `https://dorsal-chi.vercel.app`,** root directory `dorsal`,
production branch `dorsal`, region `fra1`. Every push to `dorsal` deploys.

**The domain is a liability before real sign-ups.** `*.vercel.app` subdomains
are blocked outright by some corporate networks and stripped by some email
security scanners, because they are commonly abused for phishing. That is a
plausible cause of "the magic link never arrived" and "the link won't open"
reports that has nothing to do with the redirect bug fixed in `0512af9`, and no
amount of application code can diagnose it from the inside. A custom domain —
set as the Vercel production domain, as the Supabase Site URL, and in the
redirect allow-list — is worth having before anyone is asked to sign up for
real.


---

## Decisions from wiring up the live project

**19. Every client call goes through `attempt()` (`lib/actions.ts`).** Server
actions and the auth client *reject* rather than returning an error when a
request never completes. Every call site sets a pending flag before the call
and clears it after, so a rejection left the button on "Mandando…" or
"Guardando…" for ever with nothing to act on — found by pointing the app at a
project it could not reach. One wrapper, not a try/catch repeated at eight call
sites, and `e2e/m0-sin-conexion.spec.ts` runs the whole suite against a
configured-but-unreachable project so it cannot come back.

**20. An unreachable project says so.** A request that never reached the server
is a connection problem, and "comprueba tu conexión" is more useful than "no
hemos podido mandarte el enlace" — one tells you what to do, the other tells you
nothing. supabase-js reports these with no HTTP status, which is how they are
told apart from a real rejection.

**21. Either key name works.** Supabase renamed anon keys to publishable keys
(`sb_publishable_…`), so `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is preferred and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` still works. Both are safe in a browser; neither
is the service-role key, which this app never needs.

**22. Error, not-found and loading states now exist.** They were missing, which
was a straight failure against the definition of done at the top of this file.
Signed out, an unknown plan id and an unknown route both go to the door rather
than to a 404 — telling a stranger "this plan does not exist" would tell them by
elimination which ones do, and that is exactly what hiding `solo mujeres` plans
is for.
