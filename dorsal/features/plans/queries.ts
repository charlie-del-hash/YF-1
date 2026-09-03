import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { levelInBand } from '@/lib/levels';
import type { Audience, PlanRow, SportKey, ThirdHalf } from '@/lib/database.types';

/** A plan with everything the card and the detail screen need, and nothing else. */
export interface PlanCardData {
  id: string;
  sport: SportKey;
  startsAt: string;
  durationMin: number;
  distrito: string;
  levelMin: number;
  levelMax: number;
  levelDisplay: string;
  capacity: number;
  joinedCount: number;
  thirdHalf: ThirdHalf;
  thirdHalfVenueName: string | null;
  audience: Audience;
  minPlansRequired: number;
  meetingNote: string | null;
  isSeed: boolean;
  venue: { id: string; name: string; distrito: string; lat: number; lng: number; verified: boolean } | null;
  host: { id: string; displayName: string; dorsalNumber: number; photoUrl: string | null };
}

const SELECT = `
  id, sport, starts_at, duration_min, distrito, level_min, level_max, level_display,
  capacity, joined_count, third_half, audience, min_plans_required, meeting_note,
  status, host_id, is_seed,
  venue:venues!plans_venue_id_fkey ( id, name, distrito, lat, lng, verified ),
  third_half_venue:venues!plans_third_half_venue_id_fkey ( name ),
  host:public_profiles!plans_host_id_fkey ( id, display_name, dorsal_number, photo_url )
`;

type Raw = PlanRow & {
  venue: PlanCardData['venue'] | null;
  third_half_venue: { name: string } | null;
  host: { id: string; display_name: string; dorsal_number: number; photo_url: string | null } | null;
};

function toCard(row: Raw): PlanCardData | null {
  if (!row.host) return null; // host blocked or suspended: the plan is not shown
  return {
    id: row.id,
    sport: row.sport,
    startsAt: row.starts_at,
    durationMin: row.duration_min,
    distrito: row.distrito,
    levelMin: row.level_min,
    levelMax: row.level_max,
    levelDisplay: row.level_display,
    capacity: row.capacity,
    joinedCount: row.joined_count,
    thirdHalf: row.third_half,
    thirdHalfVenueName: row.third_half_venue?.name ?? null,
    audience: row.audience,
    minPlansRequired: row.min_plans_required,
    meetingNote: row.meeting_note,
    isSeed: row.is_seed,
    venue: row.venue,
    host: {
      id: row.host.id,
      displayName: row.host.display_name,
      dorsalNumber: row.host.dorsal_number,
      photoUrl: row.host.photo_url,
    },
  };
}

export interface DeckViewer {
  id: string;
  distrito: string;
  levels: Map<SportKey, number>;
}

export async function getViewer(): Promise<DeckViewer | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: sports }] = await Promise.all([
    supabase.from('profiles').select('id, distrito').eq('id', auth.user.id).maybeSingle(),
    supabase.from('user_sports').select('sport, level_norm').eq('user_id', auth.user.id),
  ]);
  if (!profile) return null;

  return {
    id: profile.id,
    distrito: profile.distrito,
    levels: new Map((sports ?? []).map((s) => [s.sport, s.level_norm])),
  };
}

/**
 * The deck.
 *
 * Level matching is done here rather than in SQL because lib/levels.ts owns the
 * mapping in one place (CLAUDE.md) — a level band expressed twice is a level
 * band that will disagree with itself. The row count is small enough that this
 * costs nothing: only upcoming plans in the viewer's sports are fetched.
 *
 * Distance: the viewer has a distrito, never coordinates (05-RGPD §3), so
 * "within travel_km" cannot be computed without Madrid's distrito boundaries.
 * Until those are loaded from a real source, own-distrito plans sort first and
 * the rest follow by start time. It is a weaker promise than the radius slider
 * implies, and it is the honest one.
 */
export async function getDeck(viewer: DeckViewer, limit = 30): Promise<PlanCardData[]> {
  const sports = [...viewer.levels.keys()];
  if (sports.length === 0) return [];

  const supabase = await createClient();

  const [{ data: rows, error }, { data: swiped }, { data: mine }] = await Promise.all([
    supabase
      .from('plans')
      .select(SELECT)
      .in('sport', sports)
      .in('status', ['open', 'full'])
      .gt('starts_at', new Date().toISOString())
      .neq('host_id', viewer.id)
      .order('starts_at', { ascending: true })
      .limit(limit * 3),
    supabase.from('swipes').select('plan_id').eq('user_id', viewer.id),
    supabase
      .from('plan_participants')
      .select('plan_id')
      .eq('user_id', viewer.id)
      .in('status', ['joined', 'waitlist', 'attended']),
  ]);

  if (error || !rows) return [];

  const seen = new Set([
    ...(swiped ?? []).map((s) => s.plan_id),
    ...(mine ?? []).map((p) => p.plan_id),
  ]);

  return (rows as unknown as Raw[])
    .map(toCard)
    .filter((plan): plan is PlanCardData => plan !== null)
    .filter((plan) => !seen.has(plan.id))
    .filter((plan) => levelInBand(viewer.levels.get(plan.sport), plan.levelMin, plan.levelMax))
    .sort((a, b) => {
      const near = Number(b.distrito === viewer.distrito) - Number(a.distrito === viewer.distrito);
      return near !== 0 ? near : a.startsAt.localeCompare(b.startsAt);
    })
    .slice(0, limit);
}

export async function getPlan(id: string): Promise<PlanCardData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('plans').select(SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toCard(data as unknown as Raw);
}

export interface RosterEntry {
  userId: string;
  displayName: string;
  dorsalNumber: number;
  photoUrl: string | null;
  status: string;
}

/** Who is going. Blocked users are already filtered out by RLS. */
export async function getRoster(planId: string): Promise<RosterEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('plan_participants')
    .select('user_id, status, profile:public_profiles!plan_participants_user_id_fkey (display_name, dorsal_number, photo_url)')
    .eq('plan_id', planId)
    .in('status', ['joined', 'attended'])
    .order('joined_at', { ascending: true });

  type Row = {
    user_id: string;
    status: string;
    profile: { display_name: string; dorsal_number: number; photo_url: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.profile !== null)
    .map((row) => ({
      userId: row.user_id,
      displayName: row.profile!.display_name,
      dorsalNumber: row.profile!.dorsal_number,
      photoUrl: row.profile!.photo_url,
      status: row.status,
    }));
}

export async function getMyStatus(planId: string, userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('plan_participants')
    .select('status')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.status ?? null;
}
