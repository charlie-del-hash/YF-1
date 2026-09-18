'use server';

import { createClient } from '@/lib/supabase/server';
import { copy } from '@/lib/copy/es-ES';
import { sendPush } from '@/lib/push/send';

/**
 * Turning notifications on and off.
 *
 * The browser makes the subscription — the push service and the key pair are
 * its business, not ours — and this only records where to send. Unsubscribing
 * deletes the row rather than flagging it: an endpoint we are not going to use
 * is an identifier for a device, and 05-RGPD's answer to holding one of those
 * for no reason is not to.
 */
export async function saveSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  if (!input.endpoint.startsWith('https://')) {
    return { ok: false, error: copy.push.failed };
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: auth.user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) return { ok: false, error: copy.push.failed };
  return { ok: true };
}

export async function removeSubscription(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return { ok: false, error: copy.push.failed };
  return { ok: true };
}

/**
 * A notification to yourself.
 *
 * Not a debug affordance: every notification this product sends goes to
 * somebody else by design, so without this the only way to find out whether
 * notifications actually arrive on your phone is to arrange for a stranger to
 * cancel a plan on you. It reads your own subscriptions — which is all RLS
 * lets anyone do — so it needs no privileged function of its own.
 */
export async function sendTestPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .eq('user_id', auth.user.id);

  const sent = await sendPush(
    (data ?? []).map((row) => ({
      userId: row.user_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    })),
    {
      title: copy.push.testTitle,
      body: copy.push.testBody,
      url: '/mi-cuenta',
      tag: 'test',
    },
  );

  return sent > 0 ? { ok: true } : { ok: false, error: copy.push.testFailed };
}
