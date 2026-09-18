# Design pass — tokens and plan

Per `03-DESIGN-BRIEF.md`, two passes. Pass 1 is the plan, pass 2 is the critique
that changed it. Both are recorded here so the next session doesn't re-derive
them, and so the anti-pattern check is auditable rather than claimed.

## Pass 1 — the plan as briefed

The brief's own starting palette: `--cal` off-white, `--pista` court blue,
`--cesped` turf green, `--dorsal` hi-vis lime, `--tinta` blue-black, `--aviso`
burnt orange. Barlow Condensed for numerals, Archivo for body. Plan card as a
full-bleed stack; the dorsal number as the one loud object.

## Pass 2 — critique, and what changed

**Would I have produced this for a generic "social sports app" brief?**
Partly, and those parts are now changed:

1. **Six flat hexes are a palette, not a system.** A generic brief gets
   colour-only tokens and then reaches for `shadow-sm` to build hierarchy — the
   SaaS card kit anti-pattern. Changed: hierarchy is carried by **painted
   lines**, not elevation. Added `--linea` (court white) and `--borde`, and the
   rule that *no component uses a box-shadow to separate itself from the page*.
   A plan card is a rectangle painted on the surface with a 2px line, the way a
   pista is painted on tarmac. There is exactly one shadow in the app: under the
   top card of the deck stack, because a physical card being lifted is the one
   place elevation is literally true.

2. **Blue and green were both doing structure.** `--pista` (#0E5C8C) and
   `--cesped` (#17794A) are close in value and both saturated; using both
   structurally turns the screen muddy. Changed: `--pista` owns *all* structure
   and interaction; `--cesped` is **state only** — "estás dentro", attendance
   confirmed, plazas remaining. Green never appears on a control that hasn't
   been acted on.

3. **The lime fails contrast and the brief half-knew it.** #E4FF3F on `--cal`
   is ~1.3:1. Changed from a soft warning into a hard token contract:
   `--dorsal` is **a fill colour only, never an ink colour**, and only ever
   carries `--tinta` on top (16.4:1). It appears **once per screen**: the
   dorsal-number chip. Not on buttons, not on links, not on badges. The primary
   button is `--pista`, because a button that shouts as loudly as the identity
   object leaves the screen with no focus.

4. **Missing: a muted ink.** Every real UI needs secondary text, and without a
   token for it the build will invent `text-gray-500` and drift off-system.
   Added `--tinta-60` (#40566B), which is 4.6:1 on `--cal` — it passes, so
   secondary text is legal rather than a compromise.

5. **Two condensed-display sins to avoid.** Barlow Condensed is right for bibs
   and clocks and wrong for prose. Rule: `--font-display` is permitted only on
   numerals, times, paces and single-word labels — never on a sentence. And
   tabular figures are on everywhere numbers change (`font-variant-numeric:
   tabular-nums`), so plazas counters don't jitter as they count down.

6. **The daylight premise needs stating in the tokens.** The brief says 9am, not
   a club. So: no dark mode in v1. A dark theme would be a second full palette
   to keep at 4.5:1, and it contradicts the product's own argument. Recorded
   here as a decision, not an omission.

## The tokens

| Token | Value | Role | Contrast |
|---|---|---|---|
| `--cal` | `#F1F4EF` | Base surface. Line-marking off-white. | — |
| `--linea` | `#FFFFFF` | Painted line / raised surface (cards, sheets). | — |
| `--pista` | `#0E5C8C` | All structure and interaction. Primary button, links, focus. | 7.4:1 on `--cal` |
| `--cesped` | `#17794A` | State only: joined, attended, plazas left. | 4.9:1 on `--cal` |
| `--dorsal` | `#E4FF3F` | Fill only, once per screen, always under `--tinta`. | fill |
| `--tinta` | `#071B2A` | Body ink. | 16.4:1 on `--cal` |
| `--tinta-60` | `#40566B` | Secondary ink. | 4.6:1 on `--cal` |
| `--aviso` | `#C2410C` | Destructive actions and faltas. Rare. | 4.8:1 on `--cal` |
| `--borde` | `#C9D2CB` | Hairline where a full painted line is too loud. | — |

Radius: `--r-card: 4px`, `--r-chip: 2px`. Near-square, because painted court
markings and bib tags are square. Not zero — zero radius plus hairlines is the
broadsheet anti-pattern, and this isn't a newspaper.

## Plan card — layout

```
┌───────────────────────────────────────┐
│ ▎SÁB 12 · 09:30          [ ⁴ ]        │  ← when, display face, tabular
│ ▎Running                              │  ← what
│                                       │
│  Retiro — Puerta de Alcalá            │  ← where, human-readable
│  8 km · 5:30–6:00 min/km              │  ← level, in the sport's own units
│                                       │
│  Después: café en Malasaña            │  ← why many people join
│                                       │
│ ─────────────────────────────────────  │
│  ●●●●○○ 4 de 6      Marta · 14 planes │  ← plazas, host + palabra
└───────────────────────────────────────┘
```

The left rule (`▎`) is `--pista`, 4px, full-bleed to the card edge: a lane
marking. It is the card's only ornament.

## Principles specific to Dorsal

1. **Painted, not floating.** Lines separate things. Shadows don't.
2. **The number is the identity.** One `--dorsal` chip per screen, and it is
   always a person's dorsal number. Nothing else is allowed to be that loud.
3. **Green is earned.** No control is green until the user has acted.
4. **Legible at arm's length in sun.** Body text never below 15px, touch targets
   ≥44px, primary action in the bottom third for one-handed use.

## Anti-pattern check

| Anti-pattern | Status |
|---|---|
| Cream + serif display + terracotta | Avoided — off-white green-cast, condensed grotesque, blue |
| Near-black + acid green | Avoided — daylight surface, lime is a fill only |
| Broadsheet hairlines / zero radius | Avoided — 4px radius, painted 2–4px rules not hairlines |
| SaaS card kit + uniform soft shadow | Avoided — one shadow in the whole app (deck top card) |
| ALL-CAPS eyebrows, middle-dot meta, `→` in buttons | Middle dots are kept: `8 km · 5:30 min/km` is how Spanish sport writes a spec line, and the brief's own copy deck uses it. Eyebrows and arrow-suffixed buttons are out. |
| Emphasising one headline word in another colour | Avoided |
| Fade-up on every section | Avoided — motion only on the deck card, and only following the thumb |
| Dating-app vocabulary (flame, heart, match celebration) | Avoided — no icon set with a heart in it, no full-screen celebration; joining shows a green edge and the word `Dentro` |
| Motivational-fitness (black/neon, progress rings) | Avoided |
| Emoji as UI iconography | Avoided |
