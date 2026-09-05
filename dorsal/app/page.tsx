import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

/**
 * The front door decides where you actually belong: signed out → sign in,
 * signed in but no profile row → onboarding, otherwise → the deck.
 */
export default async function Home() {
  if (!supabaseConfigured()) redirect('/entrar');

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/entrar');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle();

  redirect(profile ? '/planes' : '/alta');
}
