'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { attempt } from '@/lib/actions';
import { copy } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { formatShortDate, formatWeekdayName } from '@/lib/time';
import type { SportKey } from '@/lib/sports';
import { confirmAttendance, markAttendance } from './actions';
import type { PendingHostRoster, PendingSelfCheck } from './queries';

/**
 * The post-plan questions.
 *
 * 01-PRD calls the reliability data the moat and then notes, correctly, that
 * every volunteer-run system decays on admin. So the participant's own answer
 * is two taps at the top of the screen they already open, not a separate flow —
 * and it is the side that settles the record on its own if the host never gets
 * round to the roster.
 */
export function SelfCheck({ pending }: { pending: PendingSelfCheck[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const remaining = pending.filter((p) => !done[p.planId]);
  if (remaining.length === 0) return null;

  return (
    <section className="painted p-4">
      <h2 className="font-display text-xl font-bold">{copy.attendance.pending}</h2>
      <ul className="mt-3 flex flex-col gap-4">
        {remaining.map((plan) => (
          <li key={plan.planId}>
            <p className="font-medium">
              {copy.attendance.selfTitle(formatWeekdayName(plan.startsAt))}
            </p>
            <p className="text-[15px] text-tinta-60" data-numeric>
              {getSport(plan.sport as SportKey).label} · {formatShortDate(plan.startsAt)}
            </p>
            <div className="mt-2 flex gap-3">
              {/* Both answers are weighted the same on purpose. Styling "Sí, fui"
                  as the primary action nudges people toward the answer that
                  flatters them, and this is the one place in the product where
                  the data has to be honest rather than encouraging. */}
              {([true, false] as const).map((came) => (
                <Button
                  key={String(came)}
                  variant="secondary"
                  className="flex-1"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await attempt(() => confirmAttendance(plan.planId, came));
                      if (result.ok) setDone((d) => ({ ...d, [plan.planId]: true }));
                      else setError(result.error);
                    })
                  }
                >
                  {came ? copy.attendance.yes : copy.attendance.no}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[15px] text-tinta-60">{copy.attendance.windowCloses}</p>
      {error ? (
        <p role="alert" className="mt-2 text-aviso">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** The host's roster. One tap per person, and it says how long that takes. */
export function HostRoster({ rosters }: { rosters: PendingHostRoster[] }) {
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  if (rosters.length === 0) return null;

  return (
    <section className="painted p-4">
      <h2 className="font-display text-xl font-bold">{copy.attendance.hostTitle}</h2>
      <p className="mt-1 text-tinta-60">{copy.attendance.hostHelp}</p>

      {rosters.map((roster) => (
        <div key={roster.planId} className="mt-4">
          <p className="font-medium" data-numeric>
            {getSport(roster.sport as SportKey).label} · {formatShortDate(roster.startsAt)}
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {roster.people.map((person) => {
              const key = `${roster.planId}:${person.userId}`;
              const mark = marks[key] ?? person.marked ?? null;
              return (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-tinta-60" data-numeric>
                      {person.dorsalNumber}
                    </span>
                    {person.displayName}
                  </span>
                  <span className="flex gap-2">
                    {([true, false] as const).map((came) => (
                      <Button
                        key={String(came)}
                        variant={mark === came ? 'primary' : 'secondary'}
                        className="px-3 py-1.5 text-[15px]"
                        aria-pressed={mark === came}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await attempt(() =>
                              markAttendance(roster.planId, person.userId, came),
                            );
                            if (result.ok) setMarks((m) => ({ ...m, [key]: came }));
                            else setError(result.error);
                          })
                        }
                      >
                        {came ? copy.attendance.came : copy.attendance.didNotCome}
                      </Button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {error ? (
        <p role="alert" className="mt-2 text-aviso">
          {error}
        </p>
      ) : null}
    </section>
  );
}
