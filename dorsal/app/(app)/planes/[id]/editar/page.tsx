import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { PlanForm } from '@/features/plans/plan-form';
import { getPlan, getVenues, getViewer } from '@/features/plans/queries';

export const metadata: Metadata = { title: copy.create.editTitle };
export const dynamic = 'force-dynamic';

const MADRID = { lat: 40.4168, lng: -3.7038 };

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const plan = await getPlan(id);
  if (!plan) notFound();
  // Not an error page: someone else's plan is simply not editable, and saying
  // "you are not the host" to a stranger tells them the plan exists.
  if (plan.host?.id !== viewer.id) notFound();
  if (plan.status === 'cancelled') redirect(`/planes/${id}`);

  const venues = await getVenues(viewer.distrito);

  return (
    <PlanForm
      defaults={{
        id: plan.id,
        sport: plan.sport,
        startsAt: plan.startsAt,
        durationMin: plan.durationMin,
        venueId: plan.venueId,
        thirdHalfVenueId: plan.thirdHalfVenueId,
        levelMin: plan.levelMin,
        levelMax: plan.levelMax,
        capacity: plan.capacity,
        minPlansRequired: plan.minPlansRequired,
        thirdHalf: plan.thirdHalf,
        audience: plan.audience,
        meetingNote: plan.meetingNote,
      }}
      venues={venues}
      mySports={[...viewer.levels.keys()]}
      myDistrito={viewer.distrito}
      canCreateWomenOnly={viewer.gender === 'mujer'}
      center={plan.venue ? { lat: plan.venue.lat, lng: plan.venue.lng } : MADRID}
    />
  );
}
