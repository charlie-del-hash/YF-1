'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { copy, joinErrorMessage } from '@/lib/copy/es-ES';
import { formatLevelRange } from '@/lib/levels';
import { madridInstant } from '@/lib/time';
import { planFormSchema, venuePinSchema, type PlanFormInput, type VenuePinInput } from './schema';
import type { JoinStatus } from '@/lib/database.types';

export type JoinResult =
  | { ok: true; status: Extract<JoinStatus, 'joined' | 'waitlist'> }
  | { ok: false; error: string };

/**
 * `Me apunto`. The decision is the database's — join_plan() checks capacity
 * under a row lock along with every other gate — so this only translates its
 * verdict into Spanish. Nothing here re-implements a rule.
 */
export async function joinPlan(planId: string, minPlansRequired = 0): Promise<JoinResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data, error } = await supabase.rpc('join_plan', { p_plan: planId });

  if (error) {
    // Postgres RAISE messages come through verbatim; they are the error codes.
    return { ok: false, error: joinErrorMessage(error.message.trim(), minPlansRequired) };
  }

  revalidatePath('/planes');
  revalidatePath(`/planes/${planId}`);
  return { ok: true, status: data === 'waitlist' ? 'waitlist' : 'joined' };
}

/**
 * `Paso`. Recorded rather than discarded: left swipes stop the deck repeating
 * itself, and they are the candidate pool when a plan needs rescuing 24h out
 * (01-PRD §Cold start).
 */
export async function passPlan(planId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { error } = await supabase
    .from('swipes')
    .upsert({ user_id: auth.user.id, plan_id: planId, direction: 'left' });

  return { ok: !error };
}

/**
 * `Salirme del plan`. What it costs is decided by the database — see
 * leave_plan() in migration 0002 — including whether a waitlisted person gets
 * promoted into the plaza, which happens under the same lock join_plan() takes.
 */
export type LeaveResult =
  | { ok: true; cost: 'early_cancel' | 'late_cancel' | 'waitlist_left' }
  | { ok: false; error: string };

export async function leavePlan(planId: string): Promise<LeaveResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data, error } = await supabase.rpc('leave_plan', { p_plan: planId });
  if (error) return { ok: false, error: leaveErrorMessage(error.message.trim()) };

  revalidatePath('/planes');
  revalidatePath('/mis-planes');
  revalidatePath(`/planes/${planId}`);
  const cost = data === 'late_cancel' || data === 'waitlist_left' ? data : 'early_cancel';
  return { ok: true, cost };
}

function leaveErrorMessage(code: string): string {
  switch (code) {
    case 'host_cannot_leave': return copy.errors.hostCannotLeave;
    case 'not_joined':        return copy.errors.notJoined;
    case 'plan_not_found':    return copy.errors.notFound;
    case 'not_authenticated': return copy.errors.notAuthenticated;
    default:                  return copy.errors.generic;
  }
}

/** Cancelling. A reason is required by the database, not just by the form. */
export async function cancelPlan(
  planId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_plan', { p_plan: planId, p_reason: reason });

  if (error) {
    const code = error.message.trim();
    return {
      ok: false,
      error:
        code === 'reason_required'
          ? copy.create.errors.cancelReason
          : code === 'not_host'
            ? copy.create.errors.notHost
            : copy.errors.generic,
    };
  }

  revalidatePath('/planes');
  revalidatePath('/mis-planes');
  revalidatePath(`/planes/${planId}`);
  return { ok: true };
}

/**
 * Creating and editing a plan.
 *
 * level_display is generated here from lib/levels.ts rather than typed by the
 * host or assembled in the client: it is the string every card shows, and there
 * is exactly one function that knows how each sport writes its levels.
 */
export async function savePlan(
  input: PlanFormInput,
  planId?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = planFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.errors.save };
  const form = parsed.data;

  if (form.levelMin > form.levelMax) return { ok: false, error: copy.create.errors.levelOrder };

  let startsAt: Date;
  try {
    startsAt = madridInstant(form.date, form.time);
  } catch {
    return { ok: false, error: copy.create.errors.past };
  }
  if (startsAt.getTime() <= Date.now()) return { ok: false, error: copy.create.errors.past };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data: venue } = await supabase
    .from('venues')
    .select('distrito')
    .eq('id', form.venueId)
    .maybeSingle();
  if (!venue) return { ok: false, error: copy.create.errors.venue };

  // solo mujeres plans are creatable only by someone who has declared `mujer`,
  // which is also what the RLS read policy keys off. 01-PRD §Trust and safety.
  if (form.audience === 'solo_mujeres') {
    const { data: me } = await supabase
      .from('profiles')
      .select('gender')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (me?.gender !== 'mujer') return { ok: false, error: copy.create.errors.audienceWomen };
  }

  const row = {
    host_id: auth.user.id,
    sport: form.sport,
    starts_at: startsAt.toISOString(),
    duration_min: form.durationMin,
    venue_id: form.venueId,
    third_half_venue_id: form.thirdHalf === 'ninguno' ? null : form.thirdHalfVenueId,
    distrito: venue.distrito,
    level_min: form.levelMin,
    level_max: form.levelMax,
    level_display: formatLevelRange(form.sport, form.levelMin, form.levelMax),
    capacity: form.capacity,
    third_half: form.thirdHalf,
    audience: form.audience,
    meeting_note: form.meetingNote || null,
  };

  const { data, error } = planId
    ? await supabase.from('plans').update(row).eq('id', planId).select('id').maybeSingle()
    : await supabase.from('plans').insert(row).select('id').maybeSingle();

  if (error || !data) {
    // within_capacity is the only check a host can realistically trip.
    const message = error?.message ?? '';
    return {
      ok: false,
      error: message.includes('within_capacity')
        ? copy.create.errors.capacityBelowJoined
        : message.includes('plan_already_cancelled')
          ? copy.errors.planClosed
          : copy.errors.save,
    };
  }

  revalidatePath('/planes');
  revalidatePath('/mis-planes');
  revalidatePath(`/planes/${data.id}`);
  return { ok: true, id: data.id };
}

/**
 * A host pinning a meeting point that isn't on the curated list.
 *
 * It is stored unverified and labelled as such everywhere it appears, because
 * an unconfirmed coordinate is exactly how someone ends up standing on the
 * wrong side of a park. `is_public` is forced true and enforced by a check
 * constraint: there is no code path that stores a private address.
 */
export async function createVenue(
  input: VenuePinInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = venuePinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.create.errors.venueName };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { data, error } = await supabase
    .from('venues')
    .insert({
      name: parsed.data.name,
      kind: 'otro',
      distrito: parsed.data.distrito,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      is_public: true,
      verified: false,
      created_by: auth.user.id,
    })
    .select('id')
    .maybeSingle();

  if (error || !data) return { ok: false, error: copy.errors.save };
  return { ok: true, id: data.id };
}
