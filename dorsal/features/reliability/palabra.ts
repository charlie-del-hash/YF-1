import { copy } from '@/lib/copy/es-ES';

/**
 * How a reliability record is allowed to be shown.
 *
 * 01-PRD's design rule for this feature is one sentence: reliability is a gate,
 * not a scoreboard, and nobody should feel ranked. So this module deliberately
 * cannot produce a rank, a badge, a colour or a comparison — only one of three
 * factual strings. If a future screen wants "top hosts this month", it will
 * have to go around this module, and that should be a conversation.
 */
export interface Palabra {
  /** Plans actually attended. */
  plans: number;
  /** Percentage of commitments kept, or null when there are none yet. */
  attendancePct: number | null;
  /** No commitments either way: genuinely new, not unreliable. */
  isNewcomer: boolean;
}

export const NEWCOMER: Palabra = { plans: 0, attendancePct: null, isNewcomer: true };

/**
 * `12 planes · 100% asistencia`, `Nuevo por aquí`, or `Todavía sin planes`.
 *
 * The third case is the one worth explaining. Someone who committed and did not
 * turn up has a record, so "Nuevo por aquí" would be a lie — but rendering them
 * as `0 planes · 0% asistencia` is the most public shaming this product could
 * do, and the brief forbids exactly that. They read as having no plans yet,
 * which is true, and the gate still applies to them where it matters.
 */
export function formatPalabra(palabra: Palabra): string {
  if (palabra.isNewcomer) return copy.profile.newcomer;
  if (palabra.plans === 0 || palabra.attendancePct === null) return copy.profile.noPlansYet;
  return copy.profile.palabra(copy.profile.plansAttended(palabra.plans), palabra.attendancePct);
}

/** Whether a plan's gate would let this person in. Mirrors join_plan(). */
export function meetsGate(palabra: Palabra, minPlansRequired: number): boolean {
  return palabra.plans >= minPlansRequired;
}

/**
 * The reserved plaza, mirroring newcomer_reserved() in migration 0004. The
 * database decides; this is only so a card can say a plaza is being held.
 */
export function reservedPlazas(capacity: number, minPlansRequired: number): number {
  return minPlansRequired === 0 && capacity >= 4 ? 1 : 0;
}

/** What a host may ask for. Capped at two — see 0004 for why. */
export const MAX_GATE = 2;
