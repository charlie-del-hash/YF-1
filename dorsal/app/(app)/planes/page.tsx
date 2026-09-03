import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { DeckClient } from '@/features/deck/deck-client';
import { getDeck, getViewer } from '@/features/plans/queries';

export const metadata: Metadata = { title: copy.deck.title };
export const dynamic = 'force-dynamic';

export default async function DeckPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const plans = await getDeck(viewer);
  return <DeckClient plans={plans} />;
}
