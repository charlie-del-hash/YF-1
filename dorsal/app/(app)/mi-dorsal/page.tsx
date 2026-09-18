import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bib } from '@/components/ui/bib';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { formatLevel, getSport } from '@/lib/levels';
import { createClient } from '@/lib/supabase/server';
import { formatPalabra } from '@/features/reliability/palabra';
import { getPalabra } from '@/features/reliability/queries';

export const metadata: Metadata = { title: copy.nav.profile };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/entrar');

  const [{ data: profile }, { data: sports }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, dorsal_number, distrito, travel_km, bio')
      .eq('id', auth.user.id)
      .maybeSingle(),
    supabase.from('user_sports').select('sport, level_norm').eq('user_id', auth.user.id),
  ]);
  if (!profile) redirect('/alta');

  const palabra = await getPalabra(auth.user.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center gap-4">
        <Bib number={profile.dorsal_number} size="lg" />
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">{profile.display_name}</h1>
          {/* Positive-framed and factual. Never a red score, never a ranking. */}
          <p className="text-tinta-60">{formatPalabra(palabra)}</p>
        </div>
      </header>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.profile.sports}</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {(sports ?? []).map((s) => (
            <li key={s.sport} className="flex justify-between gap-4">
              <span>{getSport(s.sport).label}</span>
              <span className="text-tinta-60" data-numeric>
                {formatLevel(s.sport, s.level_norm)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.profile.zone}</h2>
        <p className="mt-1">
          {profile.distrito} · <span data-numeric>{copy.profile.travel(profile.travel_km)}</span>
        </p>
      </section>

      <Link href="/mi-cuenta" className="text-pista underline underline-offset-4">
        {copy.account.title}
      </Link>

      <form action="/auth/salir" method="post" className="mt-auto">
        <Button type="submit" variant="secondary">
          {copy.auth.signOut}
        </Button>
      </form>
    </div>
  );
}
