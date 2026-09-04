import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Bib } from '@/components/ui/bib';
import { VenueMap } from '@/components/venue-map';
import { copy, formatThirdHalf } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { formatLongDate, formatTime } from '@/lib/time';
import {
  getLeaveCost, getMyStatus, getPlan, getRoster, getViewer,
} from '@/features/plans/queries';
import { getUnreadCounts } from '@/features/chat/queries';
import { formatPalabra, reservedPlazas } from '@/features/reliability/palabra';
import { getPalabraMany } from '@/features/reliability/queries';
import { JoinButton } from '@/features/plans/join-button';
import { HostControls, LeaveButton } from '@/features/plans/plan-actions';
import { ShareButton } from '@/features/plans/share-button';
import { SafetyMenu } from '@/features/safety/safety-menu';
import { signPhotos } from '@/features/profile/photo';

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
  const isHost = plan.host?.id === viewer.id;
  const isIn = myStatus === 'joined' || myStatus === 'waitlist' || myStatus === 'attended';
  const isCancelled = plan.status === 'cancelled';
  // Asked of the database rather than worked out here, so the sentence in the
  // confirmation and the row that gets written cannot disagree.
  const leaveCost = isIn && !isCancelled ? await getLeaveCost(id) : null;
  const unread = isIn || isHost ? ((await getUnreadCounts()).get(id) ?? 0) : 0;
  const [palabras, photos] = await Promise.all([
    getPalabraMany([...(plan.host ? [plan.host.id] : []), ...roster.map((p) => p.userId)]),
    // One batched call for the whole roster: eight people should not be eight
    // round trips to storage. See features/profile/photo.ts for why the URLs
    // are minted here rather than stored.
    signPhotos([plan.host?.photoUrl, ...roster.map((p) => p.photoUrl)]),
  ]);

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
        {isCancelled ? (
          <p className="mt-3 border-l-4 border-aviso bg-linea p-3">
            <span className="font-display text-xl font-bold text-aviso">{copy.plan.cancelled}</span>
            {plan.cancelledReason ? (
              <span className="mt-1 block">{copy.plan.cancelledBecause(plan.cancelledReason)}</span>
            ) : null}
          </p>
        ) : null}
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
        ) : reservedPlazas(plan.capacity, plan.minPlansRequired) > 0 ? (
          <p className="mt-1 text-[15px] text-tinta-60">{copy.plan.reservedPlaza}</p>
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
          {plan.host ? (
            <li className="flex items-center gap-3">
              <Avatar url={photos.get(plan.host.photoUrl ?? '') ?? null} size="sm" />
              <Bib number={plan.host.dorsalNumber} size="sm" />
              <span className="flex-1">
                <span className="font-medium">{plan.host.displayName}</span>
                <span className="block text-[15px] text-tinta-60">
                  {copy.plan.hostedBy(plan.host.displayName)}
                  {palabras.has(plan.host.id) ? (
                    <> · {formatPalabra(palabras.get(plan.host.id)!)}</>
                  ) : null}
                </span>
              </span>
              {plan.host.id === viewer.id ? null : (
                <SafetyMenu userId={plan.host.id} displayName={plan.host.displayName} planId={plan.id} />
              )}
            </li>
          ) : (
            <li className="text-tinta-60">{copy.safety.deletedAccount}</li>
          )}
          {roster.map((person) => (
            <li key={person.userId} className="flex items-center gap-3">
              <Avatar url={photos.get(person.photoUrl ?? '') ?? null} size="sm" />
              <span className="font-display text-lg font-bold text-tinta-60" data-numeric>
                {person.dorsalNumber}
              </span>
              <span className="flex-1">
                {person.displayName}
                {palabras.has(person.userId) ? (
                  <span className="block text-[15px] text-tinta-60">
                    {formatPalabra(palabras.get(person.userId)!)}
                  </span>
                ) : null}
              </span>
              {person.userId === viewer.id ? null : (
                <SafetyMenu
                  userId={person.userId}
                  displayName={person.displayName}
                  planId={plan.id}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {isIn || isHost ? (
        <Link
          href={`/planes/${plan.id}/chat`}
          className="tap inline-flex items-center justify-center rounded-[4px] border border-borde bg-linea px-4 font-medium"
        >
          {copy.chat.open}
          {unread > 0 ? (
            <span className="ml-2 rounded-[2px] bg-pista px-1.5 text-[15px] text-linea" data-numeric>
              {unread}
            </span>
          ) : null}
        </Link>
      ) : null}

      {/* A share link is a URL that travels, so it is offered only for the
          plans public_plan_preview will actually show — never a solo mujeres
          plan, and never one that is cancelled or already run. */}
      {!isCancelled && plan.audience === 'todos' ? (
        <ShareButton planId={plan.id} />
      ) : !isCancelled && isHost ? (
        <p className="text-[15px] text-tinta-60">{copy.plan.shareWomenOnly}</p>
      ) : null}

      <p className="text-[15px] text-tinta-60">{copy.safety.publicPlaces}</p>

      <div className="sticky bottom-0 mt-auto bg-cal pb-2 pt-3">
        {isCancelled ? null : isHost ? (
          <HostControls planId={plan.id} repeatsWeekly={plan.recurringRule === 'weekly'} />
        ) : isIn && leaveCost ? (
          <div className="flex flex-col gap-2">
            {myStatus === 'waitlist' ? (
              <p className="text-tinta-60">{copy.deck.waitlisted}</p>
            ) : (
              <p className="rounded-[4px] bg-cesped px-3 py-2 text-center font-display text-xl font-extrabold text-linea">
                {copy.deck.joined}
              </p>
            )}
            <LeaveButton planId={plan.id} cost={leaveCost} />
          </div>
        ) : (
          <JoinButton
            planId={plan.id}
            minPlansRequired={plan.minPlansRequired}
            initialStatus={myStatus}
            isHost={isHost}
            remaining={remaining}
          />
        )}
      </div>
    </article>
  );
}
