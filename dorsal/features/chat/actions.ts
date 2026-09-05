'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';
import { announceMessage } from '@/features/push/notify';

const bodySchema = z.string().trim().min(1).max(1000);

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Posting to a plan thread. Membership, the closing time and the author are all
 * decided by the `messages_insert_own` policy — this only reports the verdict.
 */
export async function sendMessage(planId: string, body: string): Promise<SendResult> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: body.length > 1000 ? copy.chat.tooLong : copy.chat.sendFailed };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data, error } = await supabase
    .from('messages')
    .insert({ plan_id: planId, user_id: auth.user.id, body: parsed.data })
    .select('id')
    .maybeSingle();

  // A refusal here is the policy: not a participant any more, or the chat has
  // closed. Both are things the person can see for themselves once the screen
  // refreshes, so the message says what happened rather than guessing which.
  if (error || !data) return { ok: false, error: copy.chat.sendFailed };

  // Realtime already updates everyone who has the thread open; this is for the
  // people who do not. Best effort, and never allowed to fail the send.
  await announceMessage(planId, parsed.data);

  revalidatePath(`/planes/${planId}/chat`);
  return { ok: true, id: data.id };
}

export async function deleteMessage(
  planId: string,
  messageId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  if (!error) revalidatePath(`/planes/${planId}/chat`);
  return { ok: !error };
}

export async function pinMessage(
  planId: string,
  messageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('pin_message', { p_message: messageId });
  if (error) {
    return { ok: false, error: error.message.trim() === 'not_host' ? copy.errors.generic : copy.errors.save };
  }
  revalidatePath(`/planes/${planId}/chat`);
  return { ok: true };
}

export async function unpinMessage(planId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('unpin_message', { p_plan: planId });
  if (!error) revalidatePath(`/planes/${planId}/chat`);
  return { ok: !error };
}

/** Called when the thread is opened, and after each new message arrives. */
export async function markChatRead(planId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_chat_read', { p_plan: planId });
  return { ok: !error };
}
