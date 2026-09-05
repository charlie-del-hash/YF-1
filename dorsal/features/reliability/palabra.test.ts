import { describe, expect, it } from 'vitest';
import { copy } from '@/lib/copy/es-ES';
import { MAX_GATE, NEWCOMER, formatPalabra, meetsGate, reservedPlazas } from './palabra';

describe('formatPalabra', () => {
  it('says someone is new when they have no record either way', () => {
    expect(formatPalabra(NEWCOMER)).toBe('Nuevo por aquí');
  });

  it('is factual for someone with a record', () => {
    expect(formatPalabra({ plans: 12, attendancePct: 100, isNewcomer: false }))
      .toBe('12 planes · 100% asistencia');
    expect(formatPalabra({ plans: 1, attendancePct: 50, isNewcomer: false }))
      .toBe('1 plan · 50% asistencia');
  });

  /* The case the design rule is actually about: someone who committed and did
     not turn up. "Nuevo por aquí" would be false; "0 planes · 0% asistencia"
     is the most public shaming this product could do. */
  it('never renders a zero-percent score at anyone', () => {
    const noShower = { plans: 0, attendancePct: 0, isNewcomer: false };
    expect(formatPalabra(noShower)).toBe('Todavía sin planes');
    expect(formatPalabra(noShower)).not.toContain('%');
    expect(formatPalabra(noShower)).not.toContain('0 planes');
  });

  it('produces nothing that reads as a rank, a badge or a comparison', () => {
    const samples = [
      NEWCOMER,
      { plans: 0, attendancePct: 0, isNewcomer: false },
      { plans: 3, attendancePct: 75, isNewcomer: false },
      { plans: 40, attendancePct: 98, isNewcomer: false },
    ];
    for (const sample of samples) {
      const text = formatPalabra(sample);
      expect(text).not.toMatch(/nivel|oro|plata|bronce|top|mejor|peor|puesto|ranking|puntos?/i);
      expect(text).not.toMatch(/[⭐🏆🥇✅❌]/u);
    }
  });

  it('only ever produces one of three shapes', () => {
    const shapes = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const p = { plans: i, attendancePct: i === 0 ? 0 : (i * 7) % 101, isNewcomer: false };
        return formatPalabra(p) === copy.profile.newcomer
          ? 'new'
          : formatPalabra(p) === copy.profile.noPlansYet
            ? 'none'
            : 'record';
      }),
    );
    expect([...shapes].sort()).toEqual(['none', 'record']);
  });
});

describe('meetsGate', () => {
  it('mirrors join_plan: attended plans versus the minimum', () => {
    expect(meetsGate(NEWCOMER, 0)).toBe(true);
    expect(meetsGate(NEWCOMER, 1)).toBe(false);
    expect(meetsGate({ plans: 2, attendancePct: 100, isNewcomer: false }, 2)).toBe(true);
    expect(meetsGate({ plans: 1, attendancePct: 100, isNewcomer: false }, 2)).toBe(false);
  });

  it('lets a newcomer into an ungated plan, which is the whole point', () => {
    expect(meetsGate(NEWCOMER, 0)).toBe(true);
  });
});

describe('reservedPlazas', () => {
  it('holds one plaza on an ungated plan big enough to spare it', () => {
    expect(reservedPlazas(8, 0)).toBe(1);
    expect(reservedPlazas(4, 0)).toBe(1);
  });

  it('holds none on a small plan, where one plaza is a quarter of the group', () => {
    expect(reservedPlazas(3, 0)).toBe(0);
    expect(reservedPlazas(2, 0)).toBe(0);
  });

  it('holds none on a gated plan, which is not for newcomers anyway', () => {
    expect(reservedPlazas(8, 1)).toBe(0);
    expect(reservedPlazas(8, 2)).toBe(0);
  });
});

describe('the gate ceiling', () => {
  it('is two, not ten', () => {
    expect(MAX_GATE).toBe(2);
  });
});
