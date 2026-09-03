import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Bib } from '@/components/ui/bib';
import { VenueMap } from '@/components/venue-map';
import { copy, formatThirdHalf } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { formatLongDate, formatTime } from '@/lib/time';
import { getMyStatus, getPlan, getRoster, getViewer } from '@/features/plans/queries';
import { JoinButton } from '@/features/plans/join-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const plan = await getPlan((await params).id);
  return { title: plan ? getSport(plan.sport).label : copy.errors.notFound };
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  // A plan the RLS policies hide — a solo_mujeres plan, or one from a blocked
  // host — is genuinely not found from here. There is no other query path.
  const plan = await getPlan(id);
  if (!plan) notFound();

  const [roster, myStatus] = await Promise.all([getRoster(id), getMyStatus(id, viewer.id)]);
  const sport = getSport(plan.sport);
  const remaining = Math.max(0, plan.capacity - plan.joinedCount);

  return (
    <article className="flex flex-1 flex-col gap-6 pb-4">
      <header>
        <Link href="/planes" className="text-[15px] text-pista underline underline-offset-4">
          {copy.common.back}
        </Link>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-none">{sport.label}</h1>
        <p className="mt-2 text-[17px]" data-numeric>
          {formatLongDate(plan.startsAt)} · <time dateTime={plan.startsAt}>{formatTime(plan.startsAt)}</time>{' '}
          · {copy.plan.duration(plan.durationMin)}
        </p>
        {plan.audience === 'solo_mujeres' ? (
          <p className="mt-2 inline-block rounded-[2px] border border-pista px-2 py-0.5 text-[13px] font-medium text-pista">
            {copy.plan.audience.solo_mujeres}
          </p>
        ) : null}
        {plan.isSeed ? <p className="mt-2 text-[15px] text-tinta-60">{copy.plan.seedNotice}</p> : null}
      </header>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.plan.meetingPoint}</h2>
        <div className="mt-2">
          {plan.venue ? (
            <VenueMap
              name={plan.venue.name}
              lat={plan.venue.lat}
              lng={plan.venue.lng}
              verified={plan.venue.verified}
            />
          ) : (
            <p className="text-tinta-60">{plan.distrito}</p>
          )}
        </div>
        <p className="mt-2 text-[15px] text-tinta-60">{copy.plan.publicPlaceNote}</p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.plan.level}</h2>
        <p className="mt-1" data-numeric>
          {plan.levelDisplay}
        </p>
        {plan.minPlansRequired > 0 ? (
          <p className="mt-1 text-[15px] text-tinta-60">{copy.plan.gate(plan.minPlansRequired)}</p>
        ) : null}
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.plan.after}</h2>
        <p className="mt-1">
          {formatThirdHalf(plan.thirdHalf, plan.thirdHalfVenueName)}
        </p>
      </section>

      {plan.meetingNote ? (
        <section>
          <h2 className="font-display text-xl font-bold">{copy.plan.note}</h2>
          <p className="mt-1">{plan.meetingNote}</p>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-xl font-bold">
          {copy.plan.who}{' '}
          <span className="text-tinta-60" data-numeric>
            {copy.deck.remaining.count(plan.joinedCount, plan.capacity)}
          </span>
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <Bib number={plan.host.dorsalNumber} size="sm" />
            <span>
              <span className="font-medium">{plan.host.displayName}</span>
              <span className="block text-[15px] text-tinta-60">
                {copy.plan.hostedBy(plan.host.displayName)}
              </span>
            </span>
          </li>
          {roster.map((person) => (
            <li key={person.userId} className="flex items-center gap-3">
              <span className="font-display text-lg font-bold text-tinta-60" data-numeric>
                {person.dorsalNumber}
              </span>
              <span>{person.displayName}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[15px] text-tinta-60">{copy.safety.publicPlaces}</p>

      <div className="sticky bottom-0 mt-auto bg-cal pb-2 pt-3">
        <JoinButton
          planId={plan.id}
          minPlansRequired={plan.minPlansRequired}
          initialStatus={myStatus}
          isHost={plan.host.id === viewer.id}
          remaining={remaining}
        />
      </div>
    </article>
  );
}
