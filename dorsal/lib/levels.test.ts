import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bandForNorm,
  bandsFor,
  defaultPlanBand,
  formatLevel,
  formatLevelRange,
  levelInBand,
} from './levels';
import { SPORTS, SPORT_KEYS } from './sports';

describe('bandForNorm', () => {
  it('returns the exact band when the level sits on one', () => {
    expect(bandForNorm('running', 5).display).toBe('5:30–6:00 min/km');
  });

  it('rounds a level between bands to the nearest one', () => {
    // running has bands at 4 and 5; 4 is nearer to 4.
    expect(bandForNorm('running', 4).norm).toBe(4);
  });

  it('rounds down on a tie, because claiming the slower pace is the honest way to be wrong', () => {
    // running bands: 2, 4, 5, 7, 8, 10. A 6 is equidistant from 5 and 7.
    expect(bandForNorm('running', 6).norm).toBe(5);
  });

  it('clamps to the ends rather than throwing', () => {
    expect(bandForNorm('running', 1).norm).toBe(2);
    expect(bandForNorm('running', 10).norm).toBe(10);
  });
});

describe('formatting', () => {
  it('writes each sport in its own units', () => {
    expect(formatLevel('running', 7)).toBe('5:00–5:30 min/km');
    expect(formatLevel('escalada', 5)).toBe('6a–6c / V2–V4');
    expect(formatLevel('futbol', 3)).toBe('Recreativo');
  });

  it('prefixes the racket scale, which people quote as a bare number', () => {
    expect(formatLevel('padel', 6)).toBe('Nivel 3,5–4,0');
    expect(formatLevel('tenis', 6)).toBe('Nivel 3,0–4,5');
  });

  it('uses the Spanish decimal comma', () => {
    expect(formatLevel('padel', 2)).toContain(',');
    expect(formatLevel('padel', 2)).not.toMatch(/\d\.\d/);
  });

  it('shows both ends of a plan that spans bands, and one when it does not', () => {
    expect(formatLevelRange('running', 4, 7)).toBe('6:00–7:00 min/km a 5:00–5:30 min/km');
    expect(formatLevelRange('running', 5, 5)).toBe('5:30–6:00 min/km');
  });
});

describe('levelInBand', () => {
  it('mirrors join_plan()’s check', () => {
    expect(levelInBand(5, 4, 6)).toBe(true);
    expect(levelInBand(4, 4, 6)).toBe(true);
    expect(levelInBand(6, 4, 6)).toBe(true);
    expect(levelInBand(7, 4, 6)).toBe(false);
    expect(levelInBand(3, 4, 6)).toBe(false);
  });

  it('treats "no declared level for this sport" as out of band', () => {
    expect(levelInBand(undefined, 1, 10)).toBe(false);
    expect(levelInBand(null, 1, 10)).toBe(false);
  });
});

describe('defaultPlanBand', () => {
  it('opens a plan one band either side of the host’s own level', () => {
    expect(defaultPlanBand('running', 5)).toEqual({ min: 4, max: 7 });
  });

  it('does not run off the ends of the scale', () => {
    expect(defaultPlanBand('running', 2).min).toBe(2);
    expect(defaultPlanBand('running', 10).max).toBe(10);
  });
});

describe('every sport is usable', () => {
  it.each(SPORT_KEYS)('%s has bands and formats at every norm', (key) => {
    expect(bandsFor(key).length).toBeGreaterThan(0);
    for (let norm = 1; norm <= 10; norm += 1) {
      expect(formatLevel(key, norm)).toBeTruthy();
    }
  });
});

/**
 * lib/sports.ts and supabase/seed-madrid.json describe the same catalogue for
 * two different consumers. Nothing stops them drifting except this.
 */
describe('the catalogue matches the seed file', () => {
  const seed = JSON.parse(readFileSync(new URL('../supabase/seed-madrid.json', import.meta.url), 'utf8')) as {
    sports: { key: string; label_es: string; level_scale: string; levels?: { norm: number; display: string }[] }[];
    generic_levels: { norm: number; display: string }[];
  };

  it('covers the same sports', () => {
    expect(SPORTS.map((s) => s.key).sort()).toEqual(seed.sports.map((s) => s.key).sort());
  });

  it.each(seed.sports)('$key has the same label, scale and bands', (seedSport) => {
    const sport = SPORTS.find((s) => s.key === seedSport.key);
    expect(sport).toBeDefined();
    expect(sport!.label).toBe(seedSport.label_es);
    expect(sport!.scale).toBe(seedSport.level_scale);

    const expected = seedSport.levels ?? seed.generic_levels;
    expect([...sport!.bands].sort((a, b) => a.norm - b.norm).map((b) => [b.norm, b.display])).toEqual(
      [...expected].sort((a, b) => a.norm - b.norm).map((b) => [b.norm, b.display]),
    );
  });
});
