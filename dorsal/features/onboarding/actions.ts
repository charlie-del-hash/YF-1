'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { copy } from '@/lib/copy/es-ES';
import { onboardingSchema, type OnboardingInput } from './schema';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Creates the profile and its sports in one transaction via
 * complete_onboarding(). The age check runs three times on purpose — in the
 * form, in the schema here, and as a database trigger — because the first two
 * are conveniences and only the third is a control.
 */
export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.errors.save };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  const { error } = await supabase.rpc('complete_onboarding', {
    p_display_name: parsed.data.displayName,
    p_birth_year: parsed.data.birthYear,
    p_distrito: parsed.data.distrito,
    p_travel_km: parsed.data.travelKm,
    p_gender: parsed.data.gender,
    p_photo_url: parsed.data.photoUrl,
    p_sports: parsed.data.sports.map((s) => ({ sport: s.sport, level_norm: s.levelNorm })),
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes('under_18')
        ? copy.onboarding.identity.errors.under18
        : copy.errors.save,
    };
  }
  return { ok: true };
}

export async function finishOnboarding(): Promise<never> {
  redirect('/planes');
}
