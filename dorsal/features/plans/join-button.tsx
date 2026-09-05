'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { joinPlan } from './actions';

/**
 * `Me apunto` on the detail screen. The same words as on the deck, and the
 * same server action — 03-DESIGN-BRIEF: the word survives the whole flow.
 */
export function JoinButton({
  planId,
  minPlansRequired,
  initialStatus,
  isHost,
  isSeed,
  remaining,
}: {
  planId: string;
  minPlansRequired: number;
  initialStatus: string | null;
  isHost: boolean;
  /** An example plan. join_plan() refuses these — migration 0013. */
  isSeed: boolean;
  remaining: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (isHost) {
    return <p className="text-tinta-60">{copy.errors.hostCannotJoin}</p>;
  }

  // The database refuses these, so the button does not offer it. A deck full
  // of silent dead ends is worse than one that says so — decision 16.
  if (isSeed) {
    return <p className="text-tinta-60">{copy.errors.seedPlan}</p>;
  }

  if (status === 'joined' || status === 'attended') {
    return (
      <p className="rounded-[4px] bg-cesped px-3 py-2.5 text-center font-display text-xl font-extrabold text-linea">
        {copy.deck.joined}
      </p>
    );
  }

  if (status === 'waitlist') {
    return <p className="text-tinta-60">{copy.deck.waitlisted}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-aviso">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const result = await attempt(() => joinPlan(planId, minPlansRequired));
            if (result.ok && 'status' in result) setStatus(result.status);
            else if (!result.ok) setError(result.error);
          })
        }
      >
        {remaining === 0 ? copy.deck.remaining.full : copy.deck.join}
      </Button>
    </div>
  );
}
