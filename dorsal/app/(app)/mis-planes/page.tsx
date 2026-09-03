import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlanCard } from '@/components/plan-card';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { getMyPlans, getViewer, type MyPlan } from '@/features/plans/queries';
import { getUnreadCounts } from '@/features/chat/queries';
import { getPendingAttendance } from '@/features/reliability/queries';
import { HostRoster, SelfCheck } from '@/features/reliability/attendance-prompts';

export const metadata: Metadata = { title: copy.myPlans.title };
export const dynamic = 'force-dynamic';

export default async function MyPlansPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const [{ upcoming, past }, unread, pending] = await Promise.all([
    getMyPlans(viewer),
    getUnreadCounts(),
    getPendingAttendance(viewer.id),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{copy.myPlans.title}</h1>
        <Link
          href="/planes/nuevo"
          className="tap inline-flex items-center justify-center rounded-[4px] bg-pista px-4 font-medium text-linea"
        >
          {copy.nav.create}
        </Link>
      </div>

      <SelfCheck pending={pending.self} />
      <HostRoster rosters={pending.hosting} />

      <section>
        <h2 className="font-display text-xl font-bold">{copy.myPlans.upcoming}</h2>
        {upcoming.length === 0 ? (
          <div className="painted mt-2 p-4">
            <p>{copy.myPlans.emptyUpcoming}</p>
            <Link href="/planes" className="mt-2 inline-block">
              <Button variant="secondary">{copy.myPlans.findPlans}</Button>
            </Link>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {upcoming.map((plan) => (
              <PlanRow
                key={`${plan.id}-${plan.myStatus}`}
                plan={plan}
                unread={unread.get(plan.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.myPlans.past}</h2>
        {past.length === 0 ? (
          <p className="mt-2 text-tinta-60">{copy.myPlans.emptyPast}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {past.map((plan) => (
              <PlanRow
                key={`${plan.id}-${plan.myStatus}`}
                plan={plan}
                unread={unread.get(plan.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanRow({ plan, unread }: { plan: MyPlan; unread: number }) {
  return (
    <li>
      <Link href={`/planes/${plan.id}`} className="block">
        <PlanCard plan={plan} compact />
      </Link>
      {unread > 0 ? (
        <Link
          href={`/planes/${plan.id}/chat`}
          className="mt-1 inline-block font-medium text-pista underline underline-offset-4"
        >
          {copy.chat.unread(unread)}
        </Link>
      ) : null}
      <p className="mt-1 text-[15px] text-tinta-60">
        {plan.status === 'cancelled'
          ? plan.cancelledReason
            ? copy.plan.cancelledBecause(plan.cancelledReason)
            : copy.plan.cancelled
          : plan.myStatus === 'host'
            ? copy.myPlans.hosting
            : plan.myStatus === 'waitlist'
              ? copy.myPlans.waitlisted
              : copy.deck.joined}
      </p>
    </li>
  );
}
