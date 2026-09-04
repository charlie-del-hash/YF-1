import { describe, expect, it } from 'vitest';
import { timeOfDay } from '@/lib/time';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  matchesFilters,
  parseFilters,
  serialiseFilters,
  whenRange,
} from './filters';

describe('parsing', () => {
  it('falls back to the defaults on an empty query', () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it('reads every filter', () => {
    expect(
      parseFilters({ deporte: 'padel', cuando: 'weekend', hora: 'noche', nivel: 'all', mujeres: '1', tercer: '1' }),
    ).toEqual({
      sport: 'padel', when: 'weekend', timeOfDay: 'noche', level: 'all',
      womenOnly: true, withThirdHalf: true,
    });
  });

  it('ignores junk rather than throwing', () => {
    const parsed = parseFilters({ deporte: 'quidditch', cuando: 'nunca', hora: '🌙', nivel: 'x' });
    expect(parsed.sport).toBeNull();
    expect(parsed.when).toBe('any');
    expect(parsed.timeOfDay).toBe('any');
    expect(parsed.level).toBe('mine');
  });

  it('survives a round trip', () => {
    const filters = parseFilters({ deporte: 'running', cuando: 'today', tercer: '1' });
    expect(parseFilters(Object.fromEntries(serialiseFilters(filters)))).toEqual(filters);
  });

  it('leaves a clean deck with a clean URL', () => {
    expect(serialiseFilters(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('counts what is actually on', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sport: 'padel', womenOnly: true })).toBe(2);
  });
});

describe('whenRange', () => {
  const now = new Date('2026-09-09T18:00:00+02:00'); // miércoles

  it('is open-ended by default', () => {
    expect(whenRange('any', now)).toEqual({ from: now, to: null });
  });

  it('"hoy" runs from now to the end of today, never backwards', () => {
    const { from, to } = whenRange('today', now);
    expect(from).toEqual(now);
    expect(to!.toISOString()).toBe('2026-09-09T22:00:00.000Z'); // midnight Madrid
  });

  it('"mañana" is tomorrow only', () => {
    const { from, to } = whenRange('tomorrow', now);
    expect(from.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(to!.toISOString()).toBe('2026-09-10T22:00:00.000Z');
  });

  it('"esta semana" is the next seven days', () => {
    const { to } = whenRange('week', now);
    expect(to!.toISOString()).toBe('2026-09-15T22:00:00.000Z');
  });

  it('"el finde" finds the Saturday that is coming', () => {
    const { from, to } = whenRange('weekend', now);
    expect(from.toISOString()).toBe('2026-09-11T22:00:00.000Z'); // sábado 00:00
    expect(to!.toISOString()).toBe('2026-09-13T22:00:00.000Z');  // lunes 00:00
  });

  it('during the weekend, "el finde" means the one you are in', () => {
    const saturdayEvening = new Date('2026-09-12T20:00:00+02:00');
    const { from, to } = whenRange('weekend', saturdayEvening);
    expect(from).toEqual(saturdayEvening);
    expect(to!.toISOString()).toBe('2026-09-13T22:00:00.000Z');
  });
});

describe('matchesFilters', () => {
  const levels = new Map([['running', 5]] as const);
  const plan = {
    sport: 'running' as const, startsAt: '2026-09-12T09:30:00+02:00',
    audience: 'todos' as const, thirdHalf: 'cafe', levelMin: 4, levelMax: 6,
  };

  it('keeps the deck to your level by default', () => {
    expect(matchesFilters(plan, DEFAULT_FILTERS, levels, timeOfDay)).toBe(true);
    expect(matchesFilters({ ...plan, levelMin: 8, levelMax: 10 }, DEFAULT_FILTERS, levels, timeOfDay)).toBe(false);
  });

  it('opens it up when asked', () => {
    const filters = { ...DEFAULT_FILTERS, level: 'all' as const };
    expect(matchesFilters({ ...plan, levelMin: 8, levelMax: 10 }, filters, levels, timeOfDay)).toBe(true);
  });

  it('buckets by Madrid time of day', () => {
    const morning = { ...DEFAULT_FILTERS, timeOfDay: 'manana' as const };
    const evening = { ...DEFAULT_FILTERS, timeOfDay: 'noche' as const };
    expect(matchesFilters(plan, morning, levels, timeOfDay)).toBe(true);
    expect(matchesFilters(plan, evening, levels, timeOfDay)).toBe(false);
  });
});
