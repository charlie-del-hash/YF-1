import Link from 'next/link';
import { copy } from '@/lib/copy/es-ES';

/**
 * A plan hidden by RLS — solo mujeres, or a blocked host — arrives here, and it
 * has to be indistinguishable from one that never existed. Saying "you cannot
 * see this plan" would confirm the plan exists, which is the one thing the
 * policy is there to prevent.
 */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5">
      <h1 className="font-display text-3xl font-bold">{copy.boundary.notFoundTitle}</h1>
      <p className="text-tinta-60">{copy.boundary.notFoundBody}</p>
      <Link
        href="/planes"
        className="tap inline-flex w-fit items-center justify-center rounded-[4px] bg-pista px-4 font-medium text-linea"
      >
        {copy.boundary.backToDeck}
      </Link>
    </main>
  );
}
