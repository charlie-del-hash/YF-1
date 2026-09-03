/**
 * Every date and time in Dorsal is rendered in Europe/Madrid, whatever the
 * device thinks the timezone is. CLAUDE.md rule 3: Spain switches to CEST, so
 * date maths on local strings is a bug waiting for the last Sunday in October.
 *
 * Intl does all of this natively, which is one fewer dependency reading user
 * data — see CLAUDE.md on new network-touching dependencies.
 */
export const TZ = 'Europe/Madrid';
export const LOCALE = 'es-ES';

const dayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: TZ });
const dayNumber = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: TZ });
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: TZ });
const clock = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
});
const longDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ,
});

const toDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));
const stripDot = (s: string) => s.replace(/\.$/, '');

/** `SÁB 12` — the deck card's first line, in the display face. */
export function formatDayTag(value: string | Date): string {
  const d = toDate(value);
  return `${stripDot(dayShort.format(d)).toUpperCase()} ${dayNumber.format(d)}`;
}

/** `19:30`. 24-hour, always. CLAUDE.md rule 9. */
export function formatTime(value: string | Date): string {
  return clock.format(toDate(value));
}

/** `sábado, 12 de septiembre` — the plan detail heading. */
export function formatLongDate(value: string | Date): string {
  return longDate.format(toDate(value));
}

/** `SÁB 12 · 19:30` */
export function formatWhen(value: string | Date): string {
  return `${formatDayTag(value)} · ${formatTime(value)}`;
}

/** `12 sept` — compact, for lists of past plans. */
export function formatShortDate(value: string | Date): string {
  const d = toDate(value);
  return `${dayNumber.format(d)} ${stripDot(monthShort.format(d))}`;
}

export const HOUR_MS = 3_600_000;

/** Hours between now and the plan. Negative once it has started. */
export function hoursUntil(startsAt: string | Date, now: Date = new Date()): number {
  return (toDate(startsAt).getTime() - now.getTime()) / HOUR_MS;
}

/**
 * What leaving right now costs. 02-DATA-MODEL §Domain rules 2–3.
 *
 * The 12–24h window is left deliberately undecided in the spec; the rule here
 * is that it is free, and the reason is 01-PRD's own worry about the score
 * chilling participation. Someone who cancels 18 hours out has given the host
 * most of a day to refill the plaza, and penalising that teaches tentative
 * users not to join in the first place — which is the failure mode the product
 * can least afford. Under 12 hours is where a plaza realistically cannot be
 * refilled, so that is where the falta starts.
 */
export type CancellationCost = 'early_cancel' | 'late_cancel';

export function cancellationCost(startsAt: string | Date, now: Date = new Date()): CancellationCost {
  return hoursUntil(startsAt, now) >= 12 ? 'early_cancel' : 'late_cancel';
}

/** Chat closes 48h after the plan ends. 01-PRD §Screens. */
export function chatClosesAt(startsAt: string | Date, durationMin: number): Date {
  return new Date(toDate(startsAt).getTime() + durationMin * 60_000 + 48 * HOUR_MS);
}

/** Buckets used by the deck's "Cuándo" filter. */
export type TimeOfDay = 'manana' | 'tarde' | 'noche';

export function timeOfDay(value: string | Date): TimeOfDay {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ })
      .format(toDate(value)),
  );
  // Pre-dawn belongs to the night that has not ended yet, not to the morning:
  // a plan at 00:30 is a night plan to everyone except a clock.
  if (hour < 5) return 'noche';
  if (hour < 13) return 'manana';
  if (hour < 19) return 'tarde';
  return 'noche';
}
