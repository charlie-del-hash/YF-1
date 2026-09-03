import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { defaultPlanBand } from '@/lib/levels';
import { addDays, madridDateAndTime } from '@/lib/time';
import { PlanForm } from '@/features/plans/plan-form';
import { getVenues, getViewer } from '@/features/plans/queries';

export const metadata: Metadata = { title: copy.create.title };
export const dynamic = 'force-dynamic';

/** Madrid, from seed-madrid.json. Only the starting view of the map picker. */
const MADRID = { lat: 40.4168, lng: -3.7038 };

export default async function NewPlanPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const sports = [...viewer.levels.keys()];
  if (sports.length === 0) redirect('/alta');

  const venues = await getVenues(viewer.distrito);
  const sport = sports[0]!;
  const band = defaultPlanBand(sport, viewer.levels.get(sport) ?? 5);
  // Tomorrow evening is the likeliest answer, and a prefilled form is most of
  // what "under thirty seconds for a repeat host" means.
  const tomorrow = madridDateAndTime(addDays(new Date(), 1));

  return (
    <PlanForm
      defaults={{
        sport,
        startsAt: undefined,
        durationMin: 60,
        venueId: null,
        thirdHalfVenueId: null,
        levelMin: band.min,
        levelMax: band.max,
        capacity: 8,
        thirdHalf: 'cafe',
        audience: 'todos',
        meetingNote: null,
      }}
      venues={venues}
      mySports={sports}
      myDistrito={viewer.distrito}
      canCreateWomenOnly={viewer.gender === 'mujer'}
      center={MADRID}
      initialDate={tomorrow.date}
    />
  );
}
