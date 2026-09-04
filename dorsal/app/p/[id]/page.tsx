import type { Metadata } from 'next';
import Link from 'next/link';
import { copy, formatThirdHalf } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { formatLongDate, formatTime } from '@/lib/time';
import { getPublicPlan } from '@/features/plans/queries';

export const dynamic = 'force-dynamic';

/**
 * A plan, for someone who has not signed up.
 *
 * The only screen in Dorsal that renders without a session. Everything it
 * shows comes from `public_plan_preview` (migrations 0008 and 0009), which is
 * the one function `anon` may execute: it refuses solo_mujeres plans outright,
 * and returns no roster, no coordinates and no meeting note. There is no
 * second query here and no filtering — the shape of what a stranger may see is
 * decided in the database, once.
 *
 * Deliberately not indexed: this is a link you were sent, not a listing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const plan = await getPublicPlan((await params).id);
  return {
    title: plan ? getSport(plan.sport).label : copy.publicPlan.gone.title,
    robots: { index: false, follow: false },
  };
}

export default async function PublicPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPublicPlan(id);

  if (!plan) {
    return (
      <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-8">
        <h1 className="font-display text-3xl font-bold">{copy.publicPlan.gone.title}</h1>
        <p className="text-tinta-60">{copy.publicPlan.gone.body}</p>
        <Link
          href="/entrar"
          className="tap inline-flex items-center justify-center rounded-[4px] bg-pista px-4 font-medium text-linea"
        >
          {copy.publicPlan.gone.cta}
        </Link>
      </main>
    );
  }

  const sport = getSport(plan.sport);
  const remaining = Math.max(0, plan.capacity - plan.joinedCount);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
      <p className="text-[15px] uppercase tracking-wide text-tinta-60">
        {copy.publicPlan.kicker}
      </p>

      <article className="painted flex flex-col gap-3 p-4">
        <p className="font-display text-3xl font-extrabold leading-none" data-numeric>
          {formatLongDate(plan.startsAt)}
          <span className="mx-2 font-normal text-tinta-60">·</span>
          <time dateTime={plan.startsAt}>{formatTime(plan.startsAt)}</time>
        </p>
        <h1 className="font-display text-2xl font-bold leading-tight">{sport.label}</h1>
        <p className="text-[17px]">{plan.venueName ?? plan.distrito}</p>
        <p className="text-tinta-60" data-numeric>
          {plan.levelDisplay} · {copy.plan.duration(plan.durationMin)}
        </p>
        <p className="font-medium">{formatThirdHalf(plan.thirdHalf, null)}</p>
        <p className={remaining === 0 ? 'text-tinta-60' : 'text-cesped'}>
          {remaining === 0 ? copy.publicPlan.full : copy.publicPlan.remaining(remaining)}
        </p>
        {plan.hostName ? (
          <p className="text-[15px] text-tinta-60">{copy.plan.hostedBy(plan.hostName)}</p>
        ) : null}
        <p className="text-[15px] text-tinta-60">{copy.publicPlan.rosterHidden}</p>
      </article>

      <div className="flex flex-col gap-2">
        {/* Straight to the plan once they are in, rather than dropping them in
            the deck to find it again. */}
        <Link
          href={`/entrar?volver=${encodeURIComponent(`/planes/${plan.id}`)}`}
          className="tap inline-flex items-center justify-center rounded-[4px] bg-pista px-4 font-medium text-linea"
        >
          {copy.publicPlan.join}
        </Link>
        <p className="text-[15px] text-tinta-60">{copy.publicPlan.joinHelp}</p>
      </div>

      <section className="border-t border-borde pt-4">
        <h2 className="font-display text-xl font-bold">{copy.publicPlan.whatIsThis}</h2>
        <p className="mt-1 text-tinta-60">{copy.publicPlan.pitch}</p>
        <p className="mt-3 text-[15px] text-tinta-60">{copy.safety.publicPlaces}</p>
      </section>

      <footer className="mt-auto pt-4">
        <Link href="/legal" className="text-[15px] text-pista underline underline-offset-4">
          {copy.legal.title}
        </Link>
      </footer>
    </main>
  );
}
