import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ReportReason, ReportStatus } from '@/lib/database.types';

export interface PendingCheck {
  planId: string;
  sport: string;
  startsAt: string;
}

/**
 * Plans that have happened and have not been asked about yet.
 *
 * 01-PRD asks for this "after the first plan with a new group". Asking after
 * every plan would train people to tap through it without reading, which is the
 * failure mode that matters for a question whose whole value is the rare "no" —
 * so it is asked once per plan and only until it is answered.
 */
export async function getPendingSafetyChecks(viewerId: string): Promise<PendingCheck[]> {
  const supabase = await createClient();

  const [{ data: rows }, { data: answered }] = await Promise.all([
    supabase
      .from('plan_participants')
      .select('plan_id, plan:plans!plan_participants_plan_id_fkey (sport, starts_at, duration_min, status)')
      .eq('user_id', viewerId)
      .in('status', ['joined', 'attended']),
    supabase.from('safety_checks').select('plan_id').eq('user_id', viewerId),
  ]);

  const done = new Set((answered ?? []).map((r) => r.plan_id));
  type Row = {
    plan_id: string;
    plan: { sport: string; starts_at: string; duration_min: number; status: string } | null;
  };

  return ((rows ?? []) as unknown as Row[])
    .filter((row) => row.plan && !done.has(row.plan_id) && row.plan.status !== 'cancelled')
    .filter(
      (row) => new Date(row.plan!.starts_at).getTime() + row.plan!.duration_min * 60_000 < Date.now(),
    )
    .map((row) => ({ planId: row.plan_id, sport: row.plan!.sport, startsAt: row.plan!.starts_at }));
}

export interface MyReport {
  id: string;
  reason: ReportReason;
  status: ReportStatus;
  resolution: string | null;
  createdAt: string;
}

/** 05-RGPD: "We received it and looked at it" is most of what people want. */
export async function getMyReports(): Promise<MyReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reports')
    .select('id, reason, status, resolution, created_at')
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.created_at,
  }));
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('is_admin');
  return data === true;
}
