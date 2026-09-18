# Going live

The state of the things that stand between the deploy and real strangers
meeting in a real park. Written down because the alternative is carrying them
in somebody's head.

Anything marked **you** cannot be done from a container: it needs a card, a
phone, an inbox or a lawyer.

---

## Done

- **A moderator exists.** `thepicharlie@gmail.com` (dorsal `1000`) has
  `is_admin`. `/admin` is a 404 for everyone else, on purpose — see decision 41.
  Granting it to anyone else is one statement, and it should be deliberate:
  ```sql
  update profiles set is_admin = true where id = '…';
  ```
- **Example plans cannot be joined.** Migration 0013. The seed stays visible so
  the deck is not empty for whoever signs up next, and the database refuses the
  join with `seed_plan`; the card and the button both say why. Existing
  memberships that real people had on example plans were cleared by the same
  migration.
- **The reliability view is closed.** Migration 0012 — it was readable by
  anyone holding the publishable key. See decision 64.

## Before you tell anyone about it

- [ ] **A custom domain.** *(you)* `*.vercel.app` is blocked outright by some
      corporate networks and stripped by some email security scanners, because
      it is heavily used for phishing. That looks exactly like "the magic link
      never arrived" and no amount of application code can diagnose it. Three
      places, in this order:
      1. Vercel → the `dorsal` project → Domains → add it, set as production.
      2. Supabase → Authentication → URL Configuration → **Site URL** = the new
         origin.
      3. Same screen → **Redirect URLs** → add `https://<domain>/auth/callback`.
         Do **not** add `https://*.vercel.app/**`: that is every site on the
         domain, and each one would be handed a live session token.

      No code change is needed. The magic link is built from
      `window.location.origin` in the browser (decision: `0512af9`), so it
      follows the domain automatically.

- [ ] **Push, verified on a real phone.** *(you)* The encryption is pinned to
      the RFC 8291 test vector and the VAPID signature is checked in
      `lib/push/vapid.test.ts`, but no notification has yet completed the round
      trip through a real push service. `Mi cuenta` → `Activar avisos` →
      **`Mandarme uno de prueba`**. A notification titled **Funciona** should
      arrive within seconds. A 401 from the push endpoint means VAPID; a 400
      usually means encryption.

- [ ] **The legal pages, read by someone qualified.** *(you)* They are drafts
      and say so on the page. The operator's identifying details are visible
      `[PLACEHOLDERS]` rather than invented — an NIF that looks plausible would
      be worse than an obvious gap. What is written down is the useful half:
      the decisions the code actually makes.

- [ ] **A position on injury and liability.** *(you)* Still absent, still not a
      code problem, and still the thing most likely to matter. The pre-build
      audit raised it, the spec never covered it, and nobody has answered it.

## Once the city has plans of its own

- [ ] **Retire the seed.** While there is roughly one real plan per district
      per week, the examples are doing more good than harm — they are refusing
      joins and they are labelled. When that stops being true:
      ```sql
      delete from plans   where is_seed;
      delete from profiles where is_seed;
      delete from auth.users
       where id not in (select id from profiles);
      ```
      Reversible: `supabase/seed.sql` regenerates it with fresh dates.

- [ ] **Notifications nobody triggers by acting.** Everything Dorsal sends is
      sent by the person who caused it, because there is no scheduler
      (decisions 32, 47, 54). "A plan matching your filters appeared" is the
      one people will ask for, and it needs somewhere to run recurring work.
      That is the next real milestone.

## Checks worth re-running

```bash
./scripts/pgtest.sh        # migrations, RLS, privileges, concurrency
pnpm test && pnpm test:e2e # 200+ unit, 65 browser
```

And against the live project, in the Supabase SQL editor:
`supabase/test/03-remote-check.test.sql` — nine assertions, ending in a table
of results. Nine `ok` rows means nine passed. It creates its own plans and
rolls everything back, so it is safe to run on production.

Also worth a look after any schema change: Supabase's own advisors
(Database → Advisors). The `security_definer_view` **error** there is what
surfaced the leak fixed in 0012. Most of the `authenticated_security_definer_
function_executable` warnings are by design — every RPC in this app is a
security definer function called by signed-in users — but a new one is worth
reading before dismissing.
