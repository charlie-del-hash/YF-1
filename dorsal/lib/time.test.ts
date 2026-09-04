import { describe, expect, it } from 'vitest';
import {
  addDays,
  chatClosesAt,
  formatDayTag,
  formatLongDate,
  formatTime,
  formatWhen,
  hoursUntil,
  madridDateAndTime,
  madridInstant,
  madridStartOfDay,
  madridWeekday,
  timeOfDay,
} from './time';

describe('Europe/Madrid, whatever the device thinks', () => {
  it('renders summer instants in CEST', () => {
    // 17:30 UTC in July is 19:30 in Madrid (UTC+2).
    expect(formatTime('2026-07-15T17:30:00Z')).toBe('19:30');
  });

  it('renders winter instants in CET', () => {
    // 18:30 UTC in December is 19:30 in Madrid (UTC+1).
    expect(formatTime('2026-12-15T18:30:00Z')).toBe('19:30');
  });

  it('does not shift a wall-clock time across the October changeover', () => {
    // Both of these are 19:30 local, either side of the 2026 switch — and the
    // underlying instants are an hour apart in UTC.
    expect(formatTime('2026-10-20T19:30:00+02:00')).toBe('19:30');
    expect(formatTime('2026-11-03T19:30:00+01:00')).toBe('19:30');
    expect(formatTime('2026-10-20T17:30:00Z')).toBe('19:30');
    expect(formatTime('2026-11-03T18:30:00Z')).toBe('19:30');
  });

  it('uses a 24-hour clock', () => {
    expect(formatTime('2026-07-15T20:00:00Z')).toBe('22:00');
    expect(formatTime('2026-07-15T00:15:00+02:00')).toBe('00:15');
  });
});

describe('card formatting', () => {
  it('writes the day tag as the card wants it', () => {
    // 2026-09-12 is a Saturday.
    expect(formatDayTag('2026-09-12T09:30:00+02:00')).toBe('SÁB 12');
  });

  it('joins day and time with a middle dot', () => {
    expect(formatWhen('2026-09-12T09:30:00+02:00')).toBe('SÁB 12 · 09:30');
  });

  it('writes the long date in Spanish', () => {
    expect(formatLongDate('2026-09-12T09:30:00+02:00')).toContain('septiembre');
  });
});

describe('time-of-day buckets', () => {
  it('splits the day the way the filter labels it', () => {
    expect(timeOfDay('2026-09-12T09:30:00+02:00')).toBe('manana');
    expect(timeOfDay('2026-09-12T13:00:00+02:00')).toBe('tarde');
    expect(timeOfDay('2026-09-12T19:00:00+02:00')).toBe('noche');
  });

  it('buckets by Madrid time, not UTC', () => {
    // 06:30 UTC in July is 08:30 in Madrid: a morning run, not a night one.
    expect(timeOfDay('2026-07-15T06:30:00Z')).toBe('manana');
    // 21:30 UTC is 23:30 in Madrid.
    expect(timeOfDay('2026-07-15T21:30:00Z')).toBe('noche');
  });

  it('counts the small hours as night, not as morning', () => {
    expect(timeOfDay('2026-07-16T00:30:00+02:00')).toBe('noche');
    expect(timeOfDay('2026-07-16T07:00:00+02:00')).toBe('manana');
  });
});

describe('leaving a plan', () => {
  const start = new Date('2026-09-12T09:00:00+02:00');
  const at = (hoursBefore: number) => new Date(start.getTime() - hoursBefore * 3_600_000);

  /* The cost itself is decided by leave_cost() in the database and asserted in
     supabase/test/02-lifecycle.test.sql. All this module still owes is the gap. */
  it('measures the gap in hours', () => {
    expect(hoursUntil(start, at(6))).toBeCloseTo(6);
    expect(hoursUntil(start, at(0))).toBeCloseTo(0);
    expect(hoursUntil(start, at(-2))).toBeCloseTo(-2);
  });
});

describe('chat lifetime', () => {
  it('closes 48h after the plan ends, not after it starts', () => {
    const closes = chatClosesAt('2026-09-12T09:00:00+02:00', 90);
    expect(closes.toISOString()).toBe('2026-09-14T08:30:00.000Z');
  });
});

describe('the Madrid calendar', () => {
  it('starts the day at midnight Madrid, not midnight UTC', () => {
    // 00:30 Madrid on 12 September is 22:30 UTC on the 11th.
    const start = madridStartOfDay(new Date('2026-09-12T00:30:00+02:00'));
    expect(start.toISOString()).toBe('2026-09-11T22:00:00.000Z');
  });

  it('gets the day boundary right in winter too', () => {
    const start = madridStartOfDay(new Date('2026-12-12T10:00:00+01:00'));
    expect(start.toISOString()).toBe('2026-12-11T23:00:00.000Z');
  });

  it('crosses the October changeover without losing an hour', () => {
    // Spain moves to CET on 25 October 2026. The 26th starts at 23:00Z on the 25th.
    const start = madridStartOfDay(new Date('2026-10-26T12:00:00+01:00'));
    expect(start.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('adds days by the calendar, not by 24 hours', () => {
    // Adding a day across the changeover is 25 hours of elapsed time.
    const saturday = madridStartOfDay(new Date('2026-10-24T12:00:00+02:00'));
    const sunday = addDays(saturday, 1);
    expect(sunday.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    const monday = addDays(saturday, 2);
    expect(monday.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('counts weekdays from Monday', () => {
    expect(madridWeekday(new Date('2026-09-07T10:00:00+02:00'))).toBe(1); // lunes
    expect(madridWeekday(new Date('2026-09-12T10:00:00+02:00'))).toBe(6); // sábado
    expect(madridWeekday(new Date('2026-09-13T10:00:00+02:00'))).toBe(7); // domingo
  });
});

describe('wall-clock time in, instant out', () => {
  it('reads a summer time as CEST', () => {
    expect(madridInstant('2026-09-12', '09:30').toISOString()).toBe('2026-09-12T07:30:00.000Z');
  });

  it('reads a winter time as CET', () => {
    expect(madridInstant('2026-12-12', '09:30').toISOString()).toBe('2026-12-12T08:30:00.000Z');
  });

  it('reads the morning after the clocks change correctly', () => {
    expect(madridInstant('2026-10-26', '09:30').toISOString()).toBe('2026-10-26T08:30:00.000Z');
  });

  it('round-trips through the edit form', () => {
    for (const [date, time] of [
      ['2026-09-12', '09:30'],
      ['2026-12-12', '20:00'],
      ['2026-10-26', '07:00'],
    ] as const) {
      expect(madridDateAndTime(madridInstant(date, time))).toEqual({ date, time });
    }
  });

  it('refuses nonsense rather than inventing a date', () => {
    expect(() => madridInstant('no-es-una-fecha', '09:30')).toThrow();
  });
});
