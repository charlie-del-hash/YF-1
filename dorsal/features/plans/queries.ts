import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { levelInBand } from '@/lib/levels';
import { timeOfDay } from '@/lib/time';
import {
  DEFAULT_FILTERS,
  matchesFilters,
  whenRange,
  type DeckFilters,
} from '@/features/deck/filters';
import type {
  Audience, GenderDecl, JoinStatus, PlanRow, PlanStatus, SportKey, ThirdHalf,
} from '@/lib/database.types';

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
  status: PlanStatus;
  cancelledReason: string | null;
  /** True when the viewer's own level is outside the plan's band. */
  outOfBand?: boolean;
  venueId: string | null;
  thirdHalfVenueId: string | null;
  venue: { id: string; name: string; distrito: string; lat: number; lng: number; verified: boolean } | null;
  /** null when the host deleted their account: the plan survives, cancelled. */
  host: { id: string; displayName: string; dorsalNumber: number; photoUrl: string | null } | null;
}

const SELECT = `
  id, sport, starts_at, duration_min, distrito, level_min, level_max, level_display,
  capacity, joined_count, third_half, third_half_venue_id, venue_id, audience,
  min_plans_required, meeting_note, status, cancelled_reason, host_id, is_seed,
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
  // Two different absences. A host_id that is still set but whose profile did
  // not come back is blocked or suspended, and the plan is not shown at all. A
  // host_id of null is an account that was deleted, and 0007 keeps the plan —
  // cancelled — precisely so the people who had committed still see it.
  if (row.host_id !== null && !row.host) return null;
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
    status: row.status,
    cancelledReason: row.cancelled_reason,
    venueId: row.venue_id,
    thirdHalfVenueId: row.third_half_venue_id,
    venue: row.venue,
    host: row.host
      ? {
          id: row.host.id,
          displayName: row.host.display_name,
          dorsalNumber: row.host.dorsal_number,
          photoUrl: row.host.photo_url,
        }
      : null,
  };
}

export interface DeckViewer {
  id: string;
  distrito: string;
  /** Own row only. Used to decide whether the solo mujeres controls exist at all. */
  gender: GenderDecl | null;
  levels: Map<SportKey, number>;
}

export async function getViewer(): Promise<DeckViewer | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: sports }] = await Promise.all([
    supabase.from('profiles').select('id, distrito, gender').eq('id', auth.user.id).maybeSingle(),
    supabase.from('user_sports').select('sport, level_norm').eq('user_id', auth.user.id),
  ]);
  if (!profile) return null;

  return {
    id: profile.id,
    distrito: profile.distrito,
    gender: profile.gender,
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
export async function getDeck(
  viewer: DeckViewer,
  filters: DeckFilters = DEFAULT_FILTERS,
  limit = 30,
): Promise<PlanCardData[]> {
  const sports = filters.sport ? [filters.sport] : [...viewer.levels.keys()];
  if (sports.length === 0) return [];

  const supabase = await createClient();
  const { from, to } = whenRange(filters.when);

  let query = supabase
    .from('plans')
    .select(SELECT)
    .in('sport', sports)
    .in('status', ['open', 'full'])
    .gte('starts_at', from.toISOString())
    .neq('host_id', viewer.id)
    .order('starts_at', { ascending: true })
    .limit(limit * 3);

  if (to) query = query.lt('starts_at', to.toISOString());
  // solo mujeres plans are already invisible to everyone else at the RLS layer;
  // this narrows to them for someone who can see them in the first place.
  if (filters.womenOnly) query = query.eq('audience', 'solo_mujeres');
  if (filters.withThirdHalf) query = query.neq('third_half', 'ninguno');

  const [{ data: rows, error }, { data: swiped }, { data: mine }] = await Promise.all([
    query,
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
    .filter((plan) => matchesFilters(plan, filters, viewer.levels, timeOfDay))
    .map((plan) => ({
      ...plan,
      outOfBand: !levelInBand(viewer.levels.get(plan.sport), plan.levelMin, plan.levelMax),
    }))
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

export interface VenueOption {
  id: string;
  name: string;
  kind: string;
  distrito: string;
  lat: number;
  lng: number;
  verified: boolean;
}

/** The curated meeting points, own-distrito first so the common case is at the top. */
export async function getVenues(distrito?: string): Promise<VenueOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('venues')
    .select('id, name, kind, distrito, lat, lng, verified')
    .order('distrito', { ascending: true })
    .order('name', { ascending: true });

  const venues = (data ?? []) as VenueOption[];
  if (!distrito) return venues;
  return [...venues].sort(
    (a, b) => Number(b.distrito === distrito) - Number(a.distrito === distrito),
  );
}

export interface MyPlan extends PlanCardData {
  myStatus: JoinStatus | 'host';
}

/**
 * Mis planes: everything you host and everything you joined, upcoming and past.
 * Cancelled plans stay visible — the reason is the only thing a participant
 * gets until web push lands, and hiding it would be worse than showing it.
 */
export async function getMyPlans(
  viewer: DeckViewer,
): Promise<{ upcoming: MyPlan[]; past: MyPlan[] }> {
  const supabase = await createClient();

  const [{ data: hosted }, { data: memberships }] = await Promise.all([
    supabase.from('plans').select(SELECT).eq('host_id', viewer.id).order('starts_at'),
    supabase
      .from('plan_participants')
      .select('plan_id, status')
      .eq('user_id', viewer.id)
      .in('status', ['joined', 'waitlist', 'attended']),
  ]);

  const membershipByPlan = new Map(
    (memberships ?? []).map((m) => [m.plan_id, m.status as JoinStatus]),
  );

  let joined: Raw[] = [];
  if (membershipByPlan.size > 0) {
    const { data } = await supabase
      .from('plans')
      .select(SELECT)
      .in('id', [...membershipByPlan.keys()])
      .order('starts_at');
    joined = (data ?? []) as unknown as Raw[];
  }

  const all: MyPlan[] = [
    ...((hosted ?? []) as unknown as Raw[]).map((row) => {
      const card = toCard(row);
      return card && { ...card, myStatus: 'host' as const };
    }),
    ...joined.map((row) => {
      const card = toCard(row);
      return card && { ...card, myStatus: membershipByPlan.get(row.id) ?? ('joined' as JoinStatus) };
    }),
  ].filter((plan): plan is MyPlan => plan !== null);

  const now = Date.now();
  const isPast = (plan: MyPlan) =>
    new Date(plan.startsAt).getTime() + plan.durationMin * 60_000 < now;

  return {
    upcoming: all.filter((p) => !isPast(p)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    past: all.filter(isPast).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  };
}

/**
 * What leaving would cost, according to the database. The confirmation dialog
 * shows this rather than working it out, so the words someone agrees to and the
 * row that gets written cannot disagree. See migration 0002.
 */
export async function getLeaveCost(planId: string): Promise<'early_cancel' | 'late_cancel'> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('leave_cost', { p_plan: planId });
  return data === 'late_cancel' ? 'late_cancel' : 'early_cancel';
}
