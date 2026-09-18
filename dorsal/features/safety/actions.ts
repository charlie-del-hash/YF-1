'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';
import type { ReportReason } from '@/lib/database.types';

const REASONS = ['acoso', 'peligro', 'no_aparecio', 'perfil_falso', 'spam', 'otro'] as const;

const reportSchema = z.object({
  reason: z.enum(REASONS),
  detail: z.string().trim().max(1000).nullable(),
  subjectUser: z.string().uuid().nullable(),
  subjectPlan: z.string().uuid().nullable(),
  subjectMessage: z.string().uuid().nullable(),
});

export type SafetyResult = { ok: true } | { ok: false; error: string };

/** Reporting. It goes to a person, and the reporter can see it did. */
export async function submitReport(input: {
  reason: ReportReason;
  detail?: string | null;
  subjectUser?: string | null;
  subjectPlan?: string | null;
  subjectMessage?: string | null;
}): Promise<SafetyResult> {
  const parsed = reportSchema.safeParse({
    reason: input.reason,
    detail: input.detail ?? null,
    subjectUser: input.subjectUser ?? null,
    subjectPlan: input.subjectPlan ?? null,
    subjectMessage: input.subjectMessage ?? null,
  });
  if (!parsed.success) return { ok: false, error: copy.errors.save };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { error } = await supabase.from('reports').insert({
    reporter_id: auth.user.id,
    subject_user: parsed.data.subjectUser,
    subject_plan: parsed.data.subjectPlan,
    subject_message: parsed.data.subjectMessage,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  });
  if (error) return { ok: false, error: copy.errors.save };
  return { ok: true };
}

export type BlockResult =
  | { ok: true; sharedPlanIds: string[] }
  | { ok: false; error: string };

/**
 * Blocking. Returns the upcoming plans now shared with the blocked person, so
 * the blocker can decide for themselves whether to leave them — see 0005 for
 * why nobody is ejected by anyone else.
 */
export async function blockUser(userId: string): Promise<BlockResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('block_user', { p_user: userId });
  if (error) return { ok: false, error: copy.errors.save };

  revalidatePath('/planes');
  revalidatePath('/mis-planes');
  return { ok: true, sharedPlanIds: (data ?? []).map((row) => row.plan_id) };
}

/** Leaving a plan because of a block. Never a falta. */
export async function leaveForSafety(planIds: string[]): Promise<SafetyResult> {
  const supabase = await createClient();
  for (const planId of planIds) {
    const { error } = await supabase.rpc('leave_plan_safety', { p_plan: planId });
    if (error) return { ok: false, error: copy.errors.save };
    revalidatePath(`/planes/${planId}`);
  }
  revalidatePath('/mis-planes');
  return { ok: true };
}

/** The private post-plan check. A "no" opens a report inside the database. */
export async function recordSafetyCheck(
  planId: string,
  ok: boolean,
  note?: string | null,
): Promise<SafetyResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_safety_check', {
    p_plan: planId,
    p_ok: ok,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: copy.errors.save };
  revalidatePath('/mis-planes');
  return { ok: true };
}
