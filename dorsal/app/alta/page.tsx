import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from '@/features/onboarding/onboarding-client';

export const metadata: Metadata = { title: copy.onboarding.identity.title };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/entrar');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profile) redirect('/planes');

  return <OnboardingClient />;
}
