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

// ── Madrid calendar arithmetic ───────────────────────────────────────────────
// Everything below answers "which day is it, there?", which is not the same
// question as "how many hours have passed?" on the two days a year the clocks
// move. Intl knows the rules; nothing here hardcodes an offset.

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** How far Madrid is ahead of UTC at a given instant, in milliseconds. */
function madridOffsetMs(at: Date): number {
  const parts = Object.fromEntries(
    PARTS.formatToParts(at)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  const asIfUtc = Date.UTC(
    parts.year!, parts.month! - 1, parts.day!, parts.hour! % 24, parts.minute!, parts.second!,
  );
  return asIfUtc - at.getTime();
}

/** The instant at which the Madrid day containing `at` began. */
export function madridStartOfDay(at: Date): Date {
  const offset = madridOffsetMs(at);
  const shifted = new Date(at.getTime() + offset);
  const midnightAsIfUtc = Date.UTC(
    shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(),
  );
  // Re-measure: the offset at midnight can differ from the offset now.
  const firstGuess = new Date(midnightAsIfUtc - offset);
  return new Date(midnightAsIfUtc - madridOffsetMs(firstGuess));
}

/** Calendar days, not multiples of 24 hours. */
export function addDays(at: Date, days: number): Date {
  return madridStartOfDay(new Date(at.getTime() + days * 86_400_000 + 3 * HOUR_MS));
}

/** 1 = Monday … 7 = Sunday. CLAUDE.md rule 9: the week starts on Monday. */
export function madridWeekday(at: Date): number {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(at);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
}

/**
 * A date and a time as a person in Madrid typed them ("2026-09-12", "19:30"),
 * turned into the instant they meant. The form collects wall-clock time; the
 * database stores instants; this is the only place the two are reconciled.
 */
export function madridInstant(date: string, time: string): Date {
  const asIfUtc = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(asIfUtc.getTime())) throw new Error(`invalid date/time: ${date} ${time}`);
  const guess = new Date(asIfUtc.getTime() - madridOffsetMs(asIfUtc));
  return new Date(asIfUtc.getTime() - madridOffsetMs(guess));
}

/** The inverse, for prefilling the edit form. */
export function madridDateAndTime(at: string | Date): { date: string; time: string } {
  const d = toDate(at);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return { date, time: formatTime(d) };
}

/** Hours between now and the plan. Negative once it has started. */
export function hoursUntil(startsAt: string | Date, now: Date = new Date()): number {
  return (toDate(startsAt).getTime() - now.getTime()) / HOUR_MS;
}

/**
 * What leaving costs is deliberately NOT computed here.
 *
 * `leave_cost()` in migration 0002 is the only definition of the 12-hour rule,
 * and the confirmation dialog asks it rather than working it out, so the words
 * a person agrees to and the row written to reliability_events can never
 * disagree. See CLAUDE.md for why the 12–24h window is free.
 */
export type CancellationCost = 'early_cancel' | 'late_cancel' | 'waitlist_left';

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
