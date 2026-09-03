import { describe, expect, it } from 'vitest';
import { copy } from './es-ES';

/**
 * Every formatter that takes a count. "1 filtros" and "Quedan 1 plazas" are
 * exactly the kind of thing that survives review and then sits in a screenshot
 * for a week, so the singular case is checked rather than assumed.
 */
describe('counts read as Spanish', () => {
  it('filters', () => {
    expect(copy.deck.filters.active(1)).toBe('1 filtro');
    expect(copy.deck.filters.active(3)).toBe('3 filtros');
  });

  it('remaining plazas never render the singular through the plural string', () => {
    // 1 has its own string — `Última plaza` — and the plural is only used above that.
    expect(copy.deck.remaining.some(2)).toBe('Quedan 2 plazas');
    expect(copy.deck.remaining.last).toBe('Última plaza');
  });

  it('plans attended', () => {
    expect(copy.profile.plansAttended(1)).toBe('1 plan');
    expect(copy.profile.plansAttended(12)).toBe('12 planes');
  });

  it('the gate', () => {
    expect(copy.plan.gate(1)).toBe('Para gente con 1 plan o más');
    expect(copy.plan.gate(3)).toBe('Para gente con 3 planes o más');
  });

  it('the newcomer gate error', () => {
    expect(copy.errors.needsMorePlans(1)).toContain('1 plan ');
    expect(copy.errors.needsMorePlans(3)).toContain('3 planes');
  });
});
