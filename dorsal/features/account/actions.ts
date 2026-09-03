'use server';

import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';

export type ExportResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/** 05-RGPD §5: rights are exercised in the app, not by writing to an address. */
export async function exportMyData(): Promise<ExportResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('export_my_data');
  if (error || !data) return { ok: false, error: copy.errors.load };
  return { ok: true, data: data as Record<string, unknown> };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Deleting the account, and then the selfie it may still be holding.
 *
 * The database unlinks the object's path inside the same call; this removes the
 * bytes, which needs a storage client. Order matters: the file is deleted first,
 * because once the auth row is gone this session can no longer prove it owns it.
 */
export async function deleteMyAccount(): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data: verification } = await supabase
    .from('verifications')
    .select('selfie_path')
    .eq('user_id', auth.user.id)
    .eq('kind', 'selfie')
    .maybeSingle();

  if (verification?.selfie_path) {
    await supabase.storage.from('verificaciones').remove([verification.selfie_path]);
  }

  const { error } = await supabase.rpc('delete_my_account', { p_reason: null });
  if (error) return { ok: false, error: copy.account.deleteFailed };

  await supabase.auth.signOut();
  return { ok: true };
}
