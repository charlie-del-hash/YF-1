'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
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
  remaining,
}: {
  planId: string;
  minPlansRequired: number;
  initialStatus: string | null;
  isHost: boolean;
  remaining: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (isHost) {
    return <p className="text-tinta-60">{copy.errors.hostCannotJoin}</p>;
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
            const result = await joinPlan(planId, minPlansRequired);
            if (result.ok) setStatus(result.status);
            else setError(result.error);
          })
        }
      >
        {remaining === 0 ? copy.deck.remaining.full : copy.deck.join}
      </Button>
    </div>
  );
}
