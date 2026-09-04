# Putting Dorsal on the internet

Nothing is deployed yet. Until it is, the app only runs on a laptop with the
code on it — there is no link anyone can open. This is the whole procedure,
once, about ten minutes of clicking.

You need: the GitHub account that holds this repo, and the Supabase project.

## 1. Import the repo into Vercel

1. Sign in at **vercel.com** with GitHub.
2. **Add New → Project**, and pick `charlie-del-hash/YF-1`.
3. **Set Root Directory to `dorsal`.** This is the one step that goes wrong.
   The top level of this repository is a different project (an Eleventy site);
   the app lives in the `dorsal` folder. If you skip this, the build fails with
   something confusing about a missing Next.js app.
4. Framework should say **Next.js**. Leave the build and output settings alone —
   `vercel.json` already pins the functions to Frankfurt.
5. Don't deploy yet. Add the variables first.

## 2. Environment variables

**Settings → Environment Variables**, applied to all environments:

| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page. The publishable / anon key, **not** the service role key |
| `NEXT_PUBLIC_SITE_URL` | The address Vercel gives you, e.g. `https://dorsal.vercel.app` |

`NEXT_PUBLIC_SITE_URL` is circular — you don't know the address until the first
deploy. Deploy once, copy the address Vercel shows, put it in, and redeploy.
The second deploy is the one that works.

The service-role key is not needed. Don't put it anywhere.

## 3. Tell Supabase where the sign-in links come back to

**Supabase → Authentication → URL Configuration.**

- **Site URL**: the Vercel address, exactly as above.
- **Redirect URLs**: add `https://<your-address>/auth/callback`, and
  `http://localhost:3000/**` if you also want to sign in while developing.

Skip this and sign-in links fail in a way that looks exactly like "this link has
expired", with nothing in any log to explain it.

**Do not add `https://*.vercel.app/**`.** Every entry on that list is a site
Supabase will hand a live login token to, and that pattern means every site on
the domain, not just yours.

## 4. Make yourself the moderator

Nothing in the app can grant this — deliberately. Once, in the Supabase SQL
editor, after you have signed in at least once so your account exists:

```sql
update profiles set is_admin = true where id = (
  select id from auth.users where email = 'tu@correo.com'
);
```

`/admin` is a 404 for everyone else, including you until you run this.

## 5. Optional: the map

Without `NEXT_PUBLIC_MAP_STYLE_URL` the plan screen shows the venue name and a
directions link instead of a map, which is a deliberate fallback rather than a
bug. To get real maps, get a free MapLibre style URL from MapTiler, Stadia or
Jawg and add it as another environment variable. Do not point it at
OpenStreetMap's own tile servers: their usage policy forbids it and they will
cut you off without warning.

---

## Showing it to someone

Send them the address. It works on a phone browser; there is nothing to install.

Be honest with them about what they are looking at:

- **It is in Spanish.** There is no English.
- **Signing in is a link by email.** They type an address, get a mail, tap the
  link. No password. On a phone this is the easiest kind of sign-in there is,
  but they do have to go and open the mail.
- **The plans they will see are made up.** The seed data exists so the screen
  isn't empty. Nobody will turn up to any of them. Before real people use this
  for real, delete it:
  ```sql
  delete from plans where is_seed;
  delete from profiles where is_seed;
  ```
- **There are no notifications yet.** Everything only happens while the app is
  open. That is M6.
- **The legal pages are drafts** with `[PLACEHOLDERS]` where the operator's
  details go, and they say so on the page. Fine for showing someone; not fine
  for taking real signups.

If they only want to look rather than sign in, screenshots are a better demo
than an empty account.
