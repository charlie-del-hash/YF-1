'use server';

import { revalidatePath } from 'next/cache';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';

export type MarkResult = { ok: true } | { ok: false; error: string };

/** The host's one tap per person. Settlement happens inside the database. */
export async function markAttendance(
  planId: string,
  userId: string,
  came: boolean,
): Promise<MarkResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_attendance', {
    p_plan: planId,
    p_user: userId,
    p_came: came,
  });
  if (error) return { ok: false, error: copy.attendance.saveFailed };
  revalidatePath('/mis-planes');
  revalidatePath(`/planes/${planId}`);
  return { ok: true };
}

/** And the participant's own answer, which is the side that actually gets given. */
export async function confirmAttendance(planId: string, came: boolean): Promise<MarkResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_attendance', { p_plan: planId, p_came: came });
  if (error) return { ok: false, error: copy.attendance.saveFailed };
  revalidatePath('/mis-planes');
  revalidatePath(`/planes/${planId}`);
  return { ok: true };
}
