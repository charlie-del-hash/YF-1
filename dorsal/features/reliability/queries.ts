import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { NEWCOMER, type Palabra } from './palabra';

export async function getPalabra(userId: string): Promise<Palabra> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_palabra', { p_user: userId });
  const row = data?.[0];
  if (!row) return NEWCOMER;
  return { plans: row.plans, attendancePct: row.attendance_pct, isNewcomer: row.is_newcomer };
}

/** One call for a whole roster. Blocked users simply do not come back. */
export async function getPalabraMany(userIds: string[]): Promise<Map<string, Palabra>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_palabra_many', { p_users: userIds });
  return new Map(
    (data ?? []).map((row) => [
      row.user_id,
      { plans: row.plans, attendancePct: row.attendance_pct, isNewcomer: row.is_newcomer },
    ]),
  );
}

export interface PendingSelfCheck {
  planId: string;
  sport: string;
  startsAt: string;
}

export interface PendingHostRoster {
  planId: string;
  sport: string;
  startsAt: string;
  people: { userId: string; displayName: string; dorsalNumber: number; marked: boolean | null }[];
}

/**
 * What still needs an answer after a plan.
 *
 * Overdue rows are settled first: there is no scheduler in this project, so the
 * 72-hour rule is applied the next time someone who was in the plan opens this
 * screen. It is idempotent and cheap, and it means a record cannot sit
 * unresolved for ever just because nobody ran a cron.
 */
export async function getPendingAttendance(viewerId: string): Promise<{
  self: PendingSelfCheck[];
  hosting: PendingHostRoster[];
}> {
  const supabase = await createClient();
  await supabase.rpc('settle_my_overdue_plans');

  const nowIso = new Date().toISOString();

  const [{ data: mine }, { data: hosted }] = await Promise.all([
    supabase
      .from('plan_participants')
      .select('plan_id, self_marked, settled_at, plan:plans!plan_participants_plan_id_fkey (sport, starts_at, duration_min, status)')
      .eq('user_id', viewerId)
      .is('settled_at', null)
      .is('self_marked', null)
      .in('status', ['joined', 'attended']),
    supabase
      .from('plans')
      .select('id, sport, starts_at, duration_min, status')
      .eq('host_id', viewerId)
      .lt('starts_at', nowIso)
      .neq('status', 'cancelled'),
  ]);

  type MineRow = {
    plan_id: string;
    plan: { sport: string; starts_at: string; duration_min: number; status: string } | null;
  };

  const ended = (startsAt: string, durationMin: number) =>
    new Date(startsAt).getTime() + durationMin * 60_000 < Date.now();

  const self = ((mine ?? []) as unknown as MineRow[])
    .filter((row) => row.plan && row.plan.status !== 'cancelled')
    .filter((row) => ended(row.plan!.starts_at, row.plan!.duration_min))
    .map((row) => ({ planId: row.plan_id, sport: row.plan!.sport, startsAt: row.plan!.starts_at }));

  const hosting: PendingHostRoster[] = [];
  for (const plan of (hosted ?? []) as { id: string; sport: string; starts_at: string; duration_min: number }[]) {
    if (!ended(plan.starts_at, plan.duration_min)) continue;

    const { data: roster } = await supabase
      .from('plan_participants')
      .select('user_id, host_marked, settled_at, profile:public_profiles!plan_participants_user_id_fkey (display_name, dorsal_number)')
      .eq('plan_id', plan.id)
      .is('settled_at', null)
      .in('status', ['joined', 'attended']);

    type RosterRow = {
      user_id: string;
      host_marked: boolean | null;
      profile: { display_name: string; dorsal_number: number } | null;
    };

    const people = ((roster ?? []) as unknown as RosterRow[])
      .filter((row) => row.profile !== null)
      .map((row) => ({
        userId: row.user_id,
        displayName: row.profile!.display_name,
        dorsalNumber: row.profile!.dorsal_number,
        marked: row.host_marked,
      }));

    if (people.length > 0) {
      hosting.push({ planId: plan.id, sport: plan.sport, startsAt: plan.starts_at, people });
    }
  }

  return { self, hosting };
}
