import { describe, expect, it } from 'vitest';
import { copy, formatThirdHalf, joinErrorMessage } from './es-ES';

describe('formatThirdHalf', () => {
  it('names the venue when there is one', () => {
    expect(formatThirdHalf('cafe', 'La Bicicleta')).toBe('Después: café en La Bicicleta');
  });

  it('does not stutter when the venue name already carries the noun', () => {
    // The seeded café venues are literally named "Café en Malasaña".
    expect(formatThirdHalf('cafe', 'Café en Malasaña')).toBe('Después: Café en Malasaña');
    expect(formatThirdHalf('cana', 'Caña y tapa')).toBe('Después: Caña y tapa');
  });

  it('falls back to the plain label with no venue', () => {
    expect(formatThirdHalf('cana', null)).toBe('Después: caña');
    expect(formatThirdHalf('ninguno', null)).toBe('Sin plan después');
  });

  it('ignores the venue entirely when there is no plan afterwards', () => {
    expect(formatThirdHalf('ninguno', 'Café en Chamberí')).toBe('Sin plan después');
  });
});

describe('joinErrorMessage', () => {
  it('puts every join_plan() refusal into words', () => {
    const codes = [
      'solo_mujeres', 'level_mismatch', 'host_cannot_join', 'plan_closed',
      'plan_started', 'blocked', 'removed_by_host', 'suspended', 'no_profile',
      'not_authenticated',
    ];
    for (const code of codes) {
      expect(joinErrorMessage(code)).not.toBe(copy.errors.generic);
      expect(joinErrorMessage(code).length).toBeGreaterThan(0);
    }
  });

  it('interpolates the gate into the message', () => {
    expect(joinErrorMessage('needs_more_plans', 3)).toContain('3');
  });

  it('falls back rather than showing a Postgres error to a person', () => {
    expect(joinErrorMessage('duplicate key value violates unique constraint')).toBe(
      copy.errors.generic,
    );
  });
});

describe('the copy voice', () => {
  const strings: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string') strings.push(value);
    else if (typeof value === 'function') {
      try {
        strings.push(String((value as (...args: never[]) => string)(...([2, 3] as never[]))));
      } catch {
        /* a formatter with a different shape; the literals below still cover it */
      }
    } else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(copy);

  it('collects the whole dictionary', () => {
    expect(strings.length).toBeGreaterThan(100);
  });

  /* 03-DESIGN-BRIEF: nothing from the dating-app vocabulary, and no Latin
     American forms. If a string could appear in a dating app, it is a bug. */
  it.each([
    /\bmatch\b/i, /\bligar\b/i, /\bligue\b/i, /\bcita\b/i, /\bguap[oa]s?\b/i,
    /\bsolter[oa]s?\b/i, /\bflechazo\b/i, /❤|💕|🔥/,
  ])('never says %s', (pattern) => {
    expect(strings.filter((s) => pattern.test(s))).toEqual([]);
  });

  it.each([/\bahorita\b/i, /\bcarro\b/i, /\bcelular\b/i, /\bustedes\b/i, /\busted\b/i])(
    'uses peninsular Spanish, never %s',
    (pattern) => {
      expect(strings.filter((s) => pattern.test(s))).toEqual([]);
    },
  );

  it('tutea: no usted-form verbs in the imperative buttons', () => {
    expect(copy.deck.join).toBe('Me apunto');
    expect(copy.attendance.yes).toBe('Sí, fui');
  });

  it('keeps exclamation marks rare', () => {
    expect(strings.filter((s) => s.includes('!')).length).toBeLessThanOrEqual(1);
  });
});
