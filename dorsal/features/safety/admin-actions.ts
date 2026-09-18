'use server';

import { revalidatePath } from 'next/cache';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';

export type ModerationInput = {
  action:
    | 'suspend_user'
    | 'unsuspend_user'
    | 'remove_plan'
    | 'approve_selfie'
    | 'reject_selfie'
    | 'dismiss_report'
    | 'action_report';
  reason: string;
  userId?: string;
  planId?: string;
  reportId?: string;
};

/**
 * Every moderator action goes through moderate(), which checks the admin flag,
 * insists on a reason and writes the log entry in the same transaction as the
 * change. Deciding and recording cannot come apart.
 *
 * An approved or rejected selfie also has its bytes removed here: the database
 * clears the path, and this is the only place with a storage client.
 */
export async function moderateAction(
  input: ModerationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  if (input.action === 'approve_selfie' || input.action === 'reject_selfie') {
    const { data } = await supabase
      .from('verifications')
      .select('selfie_path')
      .eq('user_id', input.userId!)
      .eq('kind', 'selfie')
      .maybeSingle();
    if (data?.selfie_path) {
      await supabase.storage.from('verificaciones').remove([data.selfie_path]);
    }
  }

  const { error } = await supabase.rpc('moderate', {
    p_action: input.action,
    p_reason: input.reason,
    p_user: input.userId ?? null,
    p_plan: input.planId ?? null,
    p_report: input.reportId ?? null,
  });

  if (error) {
    const code = error.message.trim();
    return {
      ok: false,
      error: code === 'reason_required' ? copy.admin.reasonPlaceholder : copy.errors.save,
    };
  }

  revalidatePath('/admin');
  return { ok: true };
}
