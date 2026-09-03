import Link from 'next/link';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';

/**
 * The authed shell. Middleware already redirects signed-out requests; this
 * second check is what makes a route that someone adds later safe by default.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/entrar');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile) redirect('/alta');

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-2 pt-5">
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <nav className="mt-4 flex border-t border-borde pt-2" aria-label={copy.app.name}>
        <NavLink href="/planes">{copy.nav.deck}</NavLink>
        <NavLink href="/mis-planes">{copy.nav.myPlans}</NavLink>
        <NavLink href="/planes/nuevo">{copy.nav.create}</NavLink>
        <NavLink href="/mi-dorsal">{copy.nav.profile}</NavLink>
      </nav>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="tap flex flex-1 items-center justify-center rounded-[4px] text-[15px] font-medium text-tinta-60 hover:text-pista"
    >
      {children}
    </Link>
  );
}
