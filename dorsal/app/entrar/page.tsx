import type { Metadata } from 'next';
import { copy } from '@/lib/copy/es-ES';
import { SignInForm } from '@/features/auth/sign-in-form';

export const metadata: Metadata = { title: copy.auth.title };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string; error?: string }>;
}) {
  const { volver, error } = await searchParams;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <header className="mb-8">
        <p className="font-display text-6xl font-extrabold leading-none tracking-tight text-pista">
          {copy.app.name}
        </p>
        <p className="mt-1 text-tinta-60">{copy.app.tagline}</p>
      </header>

      <h1 className="mb-2 font-display text-3xl font-bold">{copy.auth.title}</h1>
      <p className="mb-6 text-tinta-60">{copy.auth.intro}</p>

      <SignInForm redirectTo={volver} initialError={error === 'expired' ? copy.auth.errors.expiredLink : undefined} />

      <p className="mt-8 text-[15px] text-tinta-60">{copy.auth.ageNotice}</p>
      <p className="mt-2 text-[15px] text-tinta-60">{copy.safety.noDms}</p>
    </main>
  );
}
