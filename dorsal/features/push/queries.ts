import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PushTarget } from '@/lib/push/send';

type Row = { user_id: string; endpoint: string; p256dh: string; auth: string };

const toTargets = (rows: Row[] | null): PushTarget[] =>
  (rows ?? []).map((row) => ({
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  }));

/**
 * Who to notify about a plan.
 *
 * Two calls rather than one because the database decides both halves: who is
 * on the plan, and which of them the caller is entitled to reach. Neither
 * answer is computed here — see migration 0011 for why the entitlement is
 * scoped to a plan rather than to a list of people.
 */
export async function targetsForPlan(planId: string): Promise<PushTarget[]> {
  const supabase = await createClient();
  const { data: audience } = await supabase.rpc('plan_audience', { p_plan: planId });
  if (!audience || audience.length === 0) return [];

  const { data } = await supabase.rpc('push_targets_for_plan', {
    p_plan: planId,
    p_users: audience,
  });
  return toTargets(data as Row[] | null);
}

/**
 * Claims any pending waitlist promotion on a plan and returns who to tell.
 * Once-only by construction: the claim and the clear are one statement.
 */
export async function claimPromotionTargets(planId: string): Promise<PushTarget[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('notify_promotion', { p_plan: planId });
  return toTargets(data as Row[] | null);
}
