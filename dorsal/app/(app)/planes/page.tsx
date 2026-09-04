import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { DeckClient } from '@/features/deck/deck-client';
import { DeckFilterBar } from '@/features/deck/deck-filters';
import { parseFilters } from '@/features/deck/filters';
import { getDeck, getViewer } from '@/features/plans/queries';

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
  const plans = await getDeck(viewer, filters);

  return (
    <>
      <DeckFilterBar
        filters={filters}
        sports={[...viewer.levels.keys()]}
        canSeeWomenOnly={viewer.gender === 'mujer'}
      />
      <DeckClient plans={plans} />
    </>
  );
}
