# SITREP — defence journal (Eleventy site)

The live, publishable version of the SITREP defence-journal template kit.
Articles are Markdown files; Eleventy builds them into the full site — front
page, section archives, The Wire, RSS feed — and GitHub Actions deploys it on
every push.

## Run it locally

```sh
npm install
npm run dev        # → http://localhost:8080, rebuilds on save
npm run build      # one-off build into _site/
```

## Go live (once)

1. Create an empty repository on GitHub (public, no README) — e.g. `sitrep-journal`.
2. From this folder:
   ```sh
   git remote add origin https://github.com/YOURNAME/sitrep-journal.git
   git push -u origin main
   ```
3. Done. The included workflow (`.github/workflows/deploy.yml`) builds the site
   and enables GitHub Pages automatically. After the first run (~1 minute,
   visible under the repo's **Actions** tab) the site is at
   `https://YOURNAME.github.io/sitrep-journal/` — that's your shareable link.
4. Afterwards: set `url` in `src/_data/site.js` to `https://YOURNAME.github.io`
   and push again, so canonical/OG tags and the RSS feed carry absolute URLs.

Every later `git push` redeploys automatically. If the repo name isn't
`sitrep-journal`, nothing changes — the workflow reads the name itself.

## Write an article

Create `src/articles/my-article.md`:

```markdown
---
title: "The headline"
dek: "One or two sentences expanding the headline."
date: 2026-07-20
kicker: ["Air Warfare", "Cold War"]     # names matching sections become links
byline: "By the Air Warfare Desk"
tags: ["air-warfare", "history"]        # section slugs — files it on archive pages
topics: ["Israel", "SEAD"]              # display chips at the foot of the article
hero:
  ratio: "wide"
  src: "/images/my-photo.jpg"           # omit src → hatched placeholder
  alt: "Description for screen readers"
  caption: "What the reader is looking at."
  credit: "Photo: source"
featured: true                          # optional: takes the front-page lead slot
---

Body is plain Markdown. `## Headings`, **bold**, *italic*, > blockquotes.
```

That's it — the article gets its page, appears in its section archives, the
all-dispatches list, prev/next pagers, related cards and the RSS feed.

### In-article components (shortcodes)

```njk
{% raw %}{% factbox "At a glance", [["Label", "Value"], ["Date", "9–11 June 1982"]] %}

{% pullquote "Attribution line" %}The quote itself.{% endpullquote %}

{% frame { ratio: "43", src: "/images/x.jpg", alt: "…", caption: "…", credit: "Photo: source" } %}

{% dinkus %}{% endraw %}
```

### Optional front matter blocks

- `timeline:` — title + items (`date`, `title`, `text`, `key: true` for the
  filled marker). Renders after the body.
- `sources:` — list of strings (HTML allowed for `<em>`), renders the
  "Sources & further reading" block.

### Theme Thunder (period-correct editions)

`/thunder/` is the journal's period-print channel: the top articles re-set in
standalone designs native to their subject's era (a 1915 broadsheet, a 1918
assault manual, a Soviet poster, a NATOPS manual, a war-production bulletin,
a 1982 radar scope). Each edition is one self-contained `.njk` file in
`src/thunder/` — its own fonts and CSS, no shared stylesheet — that pulls the
standard article's rendered body via the `articleBySlug` filter, so the words
live in one place and the design in another.

To link an article to its themed edition, add to its front matter:

```yaml
thunder:
  url: "/thunder/my-article/"
  label: "Read it as a 1915 broadsheet"
  note: "blackletter, column rules, price one penny"
```

That renders the ⚡ cross-link box under the byline. Add a matching card in
`src/thunder/index.njk`. To theme a new article, copy the closest existing
edition in `src/thunder/` and restyle the same component classes
(`.factbox`, `.pullquote`, `.dinkus`) in its embedded CSS.

### The two other page types

- **Platform dossier** — add `layout: layouts/dossier.njk` plus `specs:`
  (spec-sheet rail), and optionally `variants:` (data table). See
  `src/articles/f14-tomcat-dossier.md`.
- **Wire edition** — create `src/wire/wire-13.md` with `edition: 13` and
  `{% raw %}{% wireitem %}{% endraw %}` blocks. `teasers:` feeds the front-page
  wire strip. See `src/wire/wire-12.md`.

## Structure

```
src/
  _data/         site.js (name/branding), sections.js (nav+archives), upcoming.js (teaser cards)
  _includes/     layouts (base, article, dossier, wire) + partials
  articles/      one .md per article
  thunder/       Theme Thunder — standalone period-correct editions + index
  wire/          one .md per wire edition
  css/style.css  the whole design system
  images/        drop photos here, reference as /images/…
  kit/           /kit/ — visual component reference (noindexed)
eleventy.config.js   filters & shortcodes
```

## Housekeeping

- **Rebrand**: edit `src/_data/site.js`; colours/fonts in `src/css/style.css`.
- **Sections**: edit `src/_data/sections.js` — nav, archives and footer update
  everywhere.
- **Sample content**: the six articles are grounded in real history with real
  sources, but re-verify every figure before putting your name on them. The
  Wire items are illustrative, not reported news — replace them. The 1915
  "telegrams" and adverts on the broadsheet Theme Thunder page are period
  pastiche, labelled as such.
- The masthead date is the build date; "Vol. I — No. 12" is a string in
  `site.js`.
