import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { encryptPayload, type PushKeys } from './encrypt';
import { vapidAuthorization, vapidKeys } from './vapid';

/**
 * Sending a notification.
 *
 * Best effort, always. A push that fails must never turn a successful action
 * into a failed one: the plan really was cancelled, the message really was
 * sent, and the person doing it should not see an error because Google was
 * slow. Everything here swallows its own failures and says so.
 */

/** What a notification says. Kept small — it is encrypted, but it is still a payload. */
export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it goes. Same-origin path only. */
  url: string;
  /** Collapses an older notification about the same thing. */
  tag?: string;
}

export interface PushTarget {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Four hours. A notification about a plan is worthless long after that. */
const TTL_SECONDS = 4 * 60 * 60;

async function deliver(
  target: PushTarget,
  message: PushMessage,
  keys: NonNullable<ReturnType<typeof vapidKeys>>,
): Promise<'ok' | 'gone' | 'failed'> {
  const subscription: PushKeys = { p256dh: target.p256dh, auth: target.auth };

  let body: Buffer;
  try {
    body = encryptPayload(JSON.stringify(message), subscription);
  } catch {
    // A subscription whose keys do not parse will never work again.
    return 'gone';
  }

  try {
    const response = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthorization(target.endpoint, keys),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(TTL_SECONDS),
        Urgency: 'normal',
      },
      body: new Uint8Array(body),
      // A push service that hangs must not hold a server action open.
      signal: AbortSignal.timeout(8_000),
    });

    // 404 and 410 are the push service saying this browser is gone for good.
    if (response.status === 404 || response.status === 410) return 'gone';
    return response.ok ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Sends to a set of targets and tidies up after itself.
 *
 * Returns how many were delivered, which is what the tests assert on. With no
 * VAPID keys configured it returns 0 without touching the network, so an
 * environment that has not been given keys behaves exactly as it did before
 * push existed.
 */
export async function sendPush(targets: PushTarget[], message: PushMessage): Promise<number> {
  const keys = vapidKeys();
  if (!keys || targets.length === 0) return 0;

  const results = await Promise.all(
    targets.map(async (target) => ({ target, outcome: await deliver(target, message, keys) })),
  );

  const supabase = await createClient();
  const delivered = results.filter((r) => r.outcome === 'ok');
  const dead = results.filter((r) => r.outcome === 'gone');

  await Promise.all([
    ...dead.map((r) => supabase.rpc('forget_push_endpoint', { p_endpoint: r.target.endpoint })),
    delivered.length > 0
      ? supabase
          .from('push_subscriptions')
          .update({ last_ok_at: new Date().toISOString() })
          .in('endpoint', delivered.map((r) => r.target.endpoint))
      : Promise.resolve(),
  ]);

  return delivered.length;
}

/** Whether this deployment can send at all. Drives whether the UI offers it. */
export function pushConfigured(): boolean {
  return vapidKeys() !== null;
}
