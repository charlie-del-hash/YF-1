'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { attempt } from '@/lib/actions';
import { copy } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { formatShortDate } from '@/lib/time';
import type { SportKey } from '@/lib/sports';
import { recordSafetyCheck } from './actions';
import type { PendingCheck } from './queries';

/**
 * `¿Todo bien?`
 *
 * Two taps for the answer that is almost always true, and a box for the one
 * that is not. The reassurance that the host cannot see it is on the screen
 * rather than in a policy, because that is the thing that decides whether
 * someone says anything at all.
 */
export function SafetyCheck({ pending }: { pending: PendingCheck[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [busy, startTransition] = useTransition();

  const remaining = pending.filter((p) => !done[p.planId]);
  if (remaining.length === 0) return null;

  return (
    <section className="painted p-4">
      <h2 className="font-display text-xl font-bold">{copy.safety.checkIn}</h2>
      <p className="mt-1 text-tinta-60">{copy.safety.checkInHelp}</p>

      <ul className="mt-3 flex flex-col gap-4">
        {remaining.map((plan) => (
          <li key={plan.planId}>
            <p className="font-medium" data-numeric>
              {getSport(plan.sport as SportKey).label} · {formatShortDate(plan.startsAt)}
            </p>

            {openNote === plan.planId ? (
              <div className="mt-2 flex flex-col gap-2">
                <Field label={copy.safety.checkInNote}>
                  {(props) => (
                    <textarea
                      {...props}
                      className={`${inputClass} min-h-20`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={1000}
                    />
                  )}
                </Field>
                <Button
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await attempt(() =>
                        recordSafetyCheck(plan.planId, false, note.trim() || null),
                      );
                      if (result.ok) {
                        setDone((d) => ({ ...d, [plan.planId]: true }));
                        setOpenNote(null);
                        setNote('');
                      } else setError(result.error);
                    })
                  }
                >
                  {copy.safety.reportSubmit}
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await attempt(() => recordSafetyCheck(plan.planId, true));
                      if (result.ok) setDone((d) => ({ ...d, [plan.planId]: true }));
                      else setError(result.error);
                    })
                  }
                >
                  {copy.safety.checkInYes}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setOpenNote(plan.planId)}
                >
                  {copy.safety.checkInNo}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-2 text-aviso">
          {error}
        </p>
      ) : null}
    </section>
  );
}
