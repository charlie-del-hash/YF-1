import { addDays, madridStartOfDay, madridWeekday } from '@/lib/time';
import { isSportKey, levelInBand } from '@/lib/levels';
import type { SportKey } from '@/lib/sports';

/**
 * Deck filters, as a pure module.
 *
 * They live in the URL rather than in component state so a filtered deck can be
 * shared, bookmarked and reloaded, and so the server can apply them to the
 * query instead of fetching a wide set and hiding most of it.
 *
 * All the date arithmetic is done in Europe/Madrid. "Hoy" has to mean the day
 * the person is standing in, and on the last Sunday in October the naive answer
 * is an hour wrong.
 */
export type WhenFilter = 'any' | 'today' | 'tomorrow' | 'week' | 'weekend';
export type TimeOfDayFilter = 'any' | 'manana' | 'tarde' | 'noche';
export type LevelFilter = 'mine' | 'all';

export interface DeckFilters {
  sport: SportKey | null;
  when: WhenFilter;
  timeOfDay: TimeOfDayFilter;
  level: LevelFilter;
  womenOnly: boolean;
  withThirdHalf: boolean;
}

export const DEFAULT_FILTERS: DeckFilters = {
  sport: null,
  when: 'any',
  timeOfDay: 'any',
  level: 'mine',
  womenOnly: false,
  withThirdHalf: false,
};

const WHEN_VALUES: WhenFilter[] = ['any', 'today', 'tomorrow', 'week', 'weekend'];
const TIME_VALUES: TimeOfDayFilter[] = ['any', 'manana', 'tarde', 'noche'];

type ParamInput = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export function parseFilters(params: ParamInput): DeckFilters {
  const sport = first(params.deporte);
  const when = first(params.cuando);
  const time = first(params.hora);
  const level = first(params.nivel);

  return {
    sport: sport && isSportKey(sport) ? sport : null,
    when: WHEN_VALUES.includes(when as WhenFilter) ? (when as WhenFilter) : 'any',
    timeOfDay: TIME_VALUES.includes(time as TimeOfDayFilter) ? (time as TimeOfDayFilter) : 'any',
    level: level === 'all' ? 'all' : 'mine',
    womenOnly: first(params.mujeres) === '1',
    withThirdHalf: first(params.tercer) === '1',
  };
}

/** Only non-default values are serialised, so a clean deck has a clean URL. */
export function serialiseFilters(filters: DeckFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.sport) params.set('deporte', filters.sport);
  if (filters.when !== 'any') params.set('cuando', filters.when);
  if (filters.timeOfDay !== 'any') params.set('hora', filters.timeOfDay);
  if (filters.level !== 'mine') params.set('nivel', filters.level);
  if (filters.womenOnly) params.set('mujeres', '1');
  if (filters.withThirdHalf) params.set('tercer', '1');
  return params;
}

export function activeFilterCount(filters: DeckFilters): number {
  return Object.entries(filters).filter(([key, value]) => {
    const fallback = DEFAULT_FILTERS[key as keyof DeckFilters];
    return value !== fallback;
  }).length;
}

/**
 * The window a `when` filter covers, as absolute instants.
 * `to` is exclusive; `null` means open-ended.
 */
export function whenRange(when: WhenFilter, now: Date = new Date()): { from: Date; to: Date | null } {
  const today = madridStartOfDay(now);

  switch (when) {
    case 'today':
      return { from: now, to: addDays(today, 1) };
    case 'tomorrow':
      return { from: addDays(today, 1), to: addDays(today, 2) };
    case 'week':
      return { from: now, to: addDays(today, 7) };
    case 'weekend': {
      // Saturday and Sunday of the weekend that is coming, or the one we are in.
      const weekday = madridWeekday(now);
      const daysToSaturday = weekday >= 6 ? 0 : 6 - weekday;
      const saturday = addDays(today, daysToSaturday);
      return { from: daysToSaturday === 0 ? now : saturday, to: addDays(saturday, 2) };
    }
    default:
      return { from: now, to: null };
  }
}

// ── applying them ────────────────────────────────────────────────────────────

export interface FilterablePlan {
  sport: SportKey;
  startsAt: string;
  audience: 'todos' | 'solo_mujeres';
  thirdHalf: string;
  levelMin: number;
  levelMax: number;
}

/**
 * The predicate the deck query cannot express: level matching, which belongs to
 * lib/levels.ts and nowhere else, and the time-of-day bucket.
 */
export function matchesFilters(
  plan: FilterablePlan,
  filters: DeckFilters,
  viewerLevels: Map<SportKey, number>,
  bucketOf: (value: string) => TimeOfDayFilter,
): boolean {
  if (filters.level === 'mine' && !levelInBand(viewerLevels.get(plan.sport), plan.levelMin, plan.levelMax)) {
    return false;
  }
  if (filters.timeOfDay !== 'any' && bucketOf(plan.startsAt) !== filters.timeOfDay) return false;
  return true;
}
