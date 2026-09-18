import 'server-only';
import { copy } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { createClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push/send';
import { claimPromotionTargets, targetsForPlan } from './queries';

/**
 * The three things Dorsal will wake a phone for.
 *
 * All of them are sent by the person who caused them, from the action that
 * caused them, because there is no scheduler in this project and no job runner
 * to hand the work to. That constraint turns out to be a feature: it means
 * every notification is sent with the sender's own permissions, so the
 * database's ordinary rules about who may see whom apply to notifications too,
 * without a second set of checks to keep in step.
 *
 * All of them are best effort. A push that fails never turns a completed
 * action into a failed one — sendPush() swallows its own errors and the
 * callers ignore the count. Nothing here is on the critical path of a plan
 * being cancelled or a message being sent.
 */

async function sportLabel(planId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('plans').select('sport').eq('id', planId).maybeSingle();
  return data ? getSport(data.sport).label : null;
}

/**
 * "Se ha caído alguien y tienes plaza."
 *
 * The string has existed since M1 with nothing able to deliver it: promotion
 * happens inside leave_plan() under a row lock, and the promoted id comes back
 * to nobody. The claim is once-only in the database, so calling this from
 * several places is safe — whichever gets there first sends it.
 */
export async function announcePromotion(planId: string): Promise<void> {
  const targets = await claimPromotionTargets(planId);
  if (targets.length === 0) return;

  const sport = await sportLabel(planId);
  if (!sport) return;

  await sendPush(targets, {
    title: copy.push.promoted.title,
    body: copy.push.promoted.body(sport),
    url: `/planes/${planId}`,
    tag: `promoted-${planId}`,
  });
}

/**
 * A cancelled plan. Since M1 the reason has been required by the database and
 * shown on the screen, and the cancel form has had to say out loud that the
 * host still needed to tell the group. This is that sentence coming true.
 */
export async function announceCancellation(planId: string, reason: string): Promise<void> {
  const sport = await sportLabel(planId);
  if (!sport) return;

  await sendPush(await targetsForPlan(planId), {
    title: copy.push.cancelled.title,
    body: copy.push.cancelled.body(sport, reason.trim()),
    url: `/planes/${planId}`,
    tag: `cancelled-${planId}`,
  });
}

/** A notification is a lock screen, and a lock screen is read over shoulders. */
const PREVIEW_CHARS = 80;

/**
 * A new message in a plan thread.
 *
 * Collapsed per plan, so a lively thread is one notification that keeps
 * updating rather than forty. The preview is short — a lock screen is read by
 * whoever is standing behind you, and the group agreeing a meeting point is
 * not a thing to broadcast in full.
 */
export async function announceMessage(planId: string, body: string): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: me } = await supabase
    .from('public_profiles')
    .select('display_name')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!me) return;

  const trimmed = body.trim();
  const preview =
    trimmed.length > PREVIEW_CHARS ? `${trimmed.slice(0, PREVIEW_CHARS).trimEnd()}…` : trimmed;

  await sendPush(await targetsForPlan(planId), {
    title: copy.push.message.title(me.display_name),
    body: copy.push.message.body(preview),
    url: `/planes/${planId}/chat`,
    tag: `chat-${planId}`,
  });
}
