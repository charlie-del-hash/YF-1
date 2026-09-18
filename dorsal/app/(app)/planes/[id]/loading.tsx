import { copy } from '@/lib/copy/es-ES';

/**
 * A painted outline of the card that is coming, not a spinner: the deck is the
 * screen, and something the shape of a plan reads as loading without saying so.
 */
export default function DeckLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">{copy.common.loading}</span>
      <div className="mb-3 h-8 w-48 rounded-[4px] bg-borde/60" />
      <div className="painted min-h-[26rem] flex-1 p-4">
        <div className="h-9 w-56 rounded-[2px] bg-borde/60" />
        <div className="mt-2 h-7 w-32 rounded-[2px] bg-borde/50" />
        <div className="mt-4 h-5 w-64 rounded-[2px] bg-borde/40" />
        <div className="mt-2 h-5 w-40 rounded-[2px] bg-borde/40" />
      </div>
    </div>
  );
}
