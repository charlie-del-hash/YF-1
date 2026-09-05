import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { defaultPlanBand } from '@/lib/levels';
import { addDays, madridDateAndTime } from '@/lib/time';
import { PlanForm } from '@/features/plans/plan-form';
import { getPlan, getVenues, getViewer } from '@/features/plans/queries';

export const metadata: Metadata = { title: copy.create.title };
export const dynamic = 'force-dynamic';

/** Madrid, from seed-madrid.json. Only the starting view of the map picker. */
const MADRID = { lat: 40.4168, lng: -3.7038 };

/**
 * Creating a plan, and repeating one.
 *
 * `?copiar=` is the whole of "duplicate": the same form, prefilled from a plan
 * the host already ran, with the date cleared. It writes a new row through the
 * same savePlan() as everything else, so a duplicate cannot drift from a
 * creation — and a host repeating last week's session answers one question.
 */
export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ copiar?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const sports = [...viewer.levels.keys()];
  if (sports.length === 0) redirect('/alta');

  const { copiar } = await searchParams;
  // Someone else's plan is not copyable: it carries their meeting note and
  // their gate, and a duplicate would read as theirs.
  const source = copiar ? await getPlan(copiar) : null;
  const template = source?.host?.id === viewer.id ? source : null;

  const venues = await getVenues(viewer.distrito);
  const sport = template?.sport ?? sports[0]!;
  const band = defaultPlanBand(sport, viewer.levels.get(sport) ?? 5);
  // Tomorrow is the likeliest answer, and a prefilled form is most of what
  // "under thirty seconds for a repeat host" means. A copy lands a week after
  // the plan it came from — same weekday, same hour, which is what "again"
  // means for a session that already worked. addDays() returns the start of
  // that day, so the hour comes from the original.
  const suggestedDate = madridDateAndTime(
    addDays(template ? new Date(template.startsAt) : new Date(), template ? 7 : 1),
  ).date;
  const suggestedTime = template ? madridDateAndTime(template.startsAt).time : undefined;

  return (
    <PlanForm
      defaults={{
        sport,
        startsAt: undefined,
        durationMin: template?.durationMin ?? 60,
        venueId: template?.venueId ?? null,
        thirdHalfVenueId: template?.thirdHalfVenueId ?? null,
        levelMin: template?.levelMin ?? band.min,
        levelMax: template?.levelMax ?? band.max,
        capacity: template?.capacity ?? 8,
        minPlansRequired: template?.minPlansRequired ?? 0,
        thirdHalf: template?.thirdHalf ?? 'cafe',
        audience: template?.audience ?? 'todos',
        // Never inherited. A host who copies a weekly plan is making one more
        // occurrence, not a second series that rolls forward beside the first.
        repeatWeekly: false,
        meetingNote: template?.meetingNote ?? null,
      }}
      venues={venues}
      mySports={sports}
      myDistrito={viewer.distrito}
      canCreateWomenOnly={viewer.gender === 'mujer'}
      center={template?.venue ? { lat: template.venue.lat, lng: template.venue.lng } : MADRID}
      initialDate={suggestedDate}
      initialTime={suggestedTime}
    />
  );
}
