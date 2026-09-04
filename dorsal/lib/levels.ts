/**
 * Level logic, in one module, in both directions: a sport's own units ⇄ the
 * normalised 1–10 `level_norm` that the deck filters on.
 *
 * CLAUDE.md: never duplicate any of this in SQL, and never re-derive it in a
 * component. 01-PRD §Nivel is explicit about why — mixed-level plans are how
 * people get humiliated and never come back — so the mapping is tested rather
 * than eyeballed.
 */
import { GENERIC_BANDS, SPORTS, type LevelBand, type Sport, type SportKey } from './sports';

const BY_KEY = new Map<SportKey, Sport>(SPORTS.map((s) => [s.key, s]));

export function getSport(key: SportKey): Sport {
  const sport = BY_KEY.get(key);
  if (!sport) throw new Error(`unknown sport: ${key}`);
  return sport;
}

export function isSportKey(value: string): value is SportKey {
  return BY_KEY.has(value as SportKey);
}

/** The bands a user picks from when declaring their level, low to high. */
export function bandsFor(sport: SportKey): readonly LevelBand[] {
  return [...getSport(sport).bands].sort((a, b) => a.norm - b.norm);
}

/**
 * The band a normalised level belongs to. Levels are stored as 1–10 but the
 * bands are sparse, so a stored 6 for running (which has bands at 5 and 7)
 * resolves to the nearest one. Ties go to the lower band: claiming the slower
 * of two paces is the honest direction to round.
 */
export function bandForNorm(sport: SportKey, norm: number): LevelBand {
  const bands = bandsFor(sport);
  let best = bands[0]!;
  let bestDistance = Math.abs(best.norm - norm);
  for (const band of bands.slice(1)) {
    const distance = Math.abs(band.norm - norm);
    if (distance < bestDistance) {
      best = band;
      bestDistance = distance;
    }
  }
  return best;
}

/** How a single declared level reads on a profile: "5:30–6:00 min/km". */
export function formatLevel(sport: SportKey, norm: number): string {
  return withScalePrefix(getSport(sport), bandForNorm(sport, norm).display);
}

/**
 * How a plan's accepted band reads on a card. A plan spanning several bands
 * shows its ends; a plan inside one band shows that band.
 */
export function formatLevelRange(sport: SportKey, min: number, max: number): string {
  const low = bandForNorm(sport, min);
  const high = bandForNorm(sport, max);
  if (low.display === high.display) return withScalePrefix(getSport(sport), low.display);
  // Joined with "a", not a dash: most bands are themselves ranges written with
  // an en dash, and "6:00–7:00 – 5:00–5:30" is unreadable.
  return withScalePrefix(getSport(sport), `${low.display} a ${high.display}`);
}

/** Pádel and tenis are the one scale people quote as a bare number. */
function withScalePrefix(sport: Sport, display: string): string {
  return sport.scale === 'padel_1_7' ? `Nivel ${display}` : display;
}

/** Whether a user may join: 02-DATA-MODEL, mirrored by join_plan()'s check. */
export function levelInBand(userNorm: number | null | undefined, min: number, max: number): boolean {
  return typeof userNorm === 'number' && userNorm >= min && userNorm <= max;
}

/** The band range a plan should default to when a host declares their own level. */
export function defaultPlanBand(sport: SportKey, hostNorm: number): { min: number; max: number } {
  const bands = bandsFor(sport);
  const index = bands.findIndex((b) => b.norm === bandForNorm(sport, hostNorm).norm);
  const below = bands[Math.max(0, index - 1)]!;
  const above = bands[Math.min(bands.length - 1, index + 1)]!;
  return { min: below.norm, max: above.norm };
}

export { GENERIC_BANDS };
export type { LevelBand, Sport, SportKey };
