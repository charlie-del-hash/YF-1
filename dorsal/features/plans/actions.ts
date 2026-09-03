'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { copy, joinErrorMessage } from '@/lib/copy/es-ES';
import type { JoinStatus } from '@/lib/database.types';

export type JoinResult =
  | { ok: true; status: Extract<JoinStatus, 'joined' | 'waitlist'> }
  | { ok: false; error: string };

/**
 * `Me apunto`. The decision is the database's — join_plan() checks capacity
 * under a row lock along with every other gate — so this only translates its
 * verdict into Spanish. Nothing here re-implements a rule.
 */
export async function joinPlan(planId: string, minPlansRequired = 0): Promise<JoinResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data, error } = await supabase.rpc('join_plan', { p_plan: planId });

  if (error) {
    // Postgres RAISE messages come through verbatim; they are the error codes.
    return { ok: false, error: joinErrorMessage(error.message.trim(), minPlansRequired) };
  }

  revalidatePath('/planes');
  revalidatePath(`/planes/${planId}`);
  return { ok: true, status: data === 'waitlist' ? 'waitlist' : 'joined' };
}

/**
 * `Paso`. Recorded rather than discarded: left swipes stop the deck repeating
 * itself, and they are the candidate pool when a plan needs rescuing 24h out
 * (01-PRD §Cold start).
 */
export async function passPlan(planId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { error } = await supabase
    .from('swipes')
    .upsert({ user_id: auth.user.id, plan_id: planId, direction: 'left' });

  return { ok: !error };
}
