import { describe, expect, it } from 'vitest';
import {
  cancellationCost,
  chatClosesAt,
  formatDayTag,
  formatLongDate,
  formatTime,
  formatWhen,
  hoursUntil,
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

  it('is free two days out', () => {
    expect(cancellationCost(start, at(48))).toBe('early_cancel');
  });

  it('is free at exactly 24 hours', () => {
    expect(cancellationCost(start, at(24))).toBe('early_cancel');
  });

  it('is still free in the 12–24h window, because a plaza can be refilled', () => {
    expect(cancellationCost(start, at(18))).toBe('early_cancel');
    expect(cancellationCost(start, at(12))).toBe('early_cancel');
  });

  it('counts as a falta under 12 hours', () => {
    expect(cancellationCost(start, at(11.9))).toBe('late_cancel');
    expect(cancellationCost(start, at(1))).toBe('late_cancel');
  });

  it('counts as a falta after the plan has started', () => {
    expect(cancellationCost(start, at(-1))).toBe('late_cancel');
  });

  it('measures the gap in hours', () => {
    expect(hoursUntil(start, at(6))).toBeCloseTo(6);
  });
});

describe('chat lifetime', () => {
  it('closes 48h after the plan ends, not after it starts', () => {
    const closes = chatClosesAt('2026-09-12T09:00:00+02:00', 90);
    expect(closes.toISOString()).toBe('2026-09-14T08:30:00.000Z');
  });
});
