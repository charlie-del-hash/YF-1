import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { DeckClient } from '@/features/deck/deck-client';
import { DeckFilterBar } from '@/features/deck/deck-filters';
import { parseFilters } from '@/features/deck/filters';
import { getDeck, getPlansNeedingPeople, getViewer } from '@/features/plans/queries';

export const metadata: Metadata = { title: copy.deck.title };
export const dynamic = 'force-dynamic';

export default async function DeckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const filters = parseFilters(await searchParams);
  // Fetched with the deck rather than after it, because it is only ever shown
  // once the deck is empty and a second round trip at that moment reads as the
  // screen breaking.
  const [plans, needPeople] = await Promise.all([
    getDeck(viewer, filters),
    getPlansNeedingPeople(),
  ]);

  return (
    <>
      <DeckFilterBar
        filters={filters}
        sports={[...viewer.levels.keys()]}
        canSeeWomenOnly={viewer.gender === 'mujer'}
      />
      <DeckClient plans={plans} needPeople={needPeople} />
    </>
  );
}
