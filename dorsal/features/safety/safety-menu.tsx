'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { attempt } from '@/lib/actions';
import { copy } from '@/lib/copy/es-ES';
import type { ReportReason } from '@/lib/database.types';
import { blockUser, leaveForSafety, submitReport } from './actions';

const REASONS: ReportReason[] = ['acoso', 'peligro', 'no_aparecio', 'perfil_falso', 'spam', 'otro'];

type View = 'closed' | 'menu' | 'report' | 'block' | 'sent' | 'blocked';

/**
 * Report and block, from wherever a person appears.
 *
 * 01-PRD asks for three taps maximum, which is what the shape here is for:
 * open, choose a reason, send. Nothing is buried behind a profile screen,
 * because the moment someone wants this is the moment they are least willing to
 * go looking for it.
 */
export function SafetyMenu({
  userId,
  displayName,
  planId,
  messageId,
}: {
  userId: string;
  displayName: string;
  planId?: string;
  messageId?: string;
}) {
  const [view, setView] = useState<View>('closed');
  const [reason, setReason] = useState<ReportReason>('acoso');
  const [detail, setDetail] = useState('');
  const [shared, setShared] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (view === 'closed') {
    return (
      <Button
        variant="quiet"
        className="px-1 text-[13px]"
        aria-label={`${copy.safety.menu} · ${displayName}`}
        onClick={() => setView('menu')}
      >
        {copy.safety.menu}
      </Button>
    );
  }

  return (
    <div className="w-full border border-borde bg-linea p-3">
      {error ? (
        <p role="alert" className="mb-2 text-aviso">
          {error}
        </p>
      ) : null}

      {view === 'menu' ? (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setView('report')}>
            {copy.safety.report}
          </Button>
          <Button variant="secondary" onClick={() => setView('block')}>
            {copy.safety.block}
          </Button>
          <Button variant="quiet" className="px-0" onClick={() => setView('closed')}>
            {copy.common.close}
          </Button>
        </div>
      ) : null}

      {view === 'report' ? (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">{copy.safety.reportTitle}</h3>
          <p className="text-[15px] text-tinta-60">{copy.safety.reportHelp}</p>
          <ul className="flex flex-col gap-2">
            {REASONS.map((value) => (
              <li key={value}>
                <button
                  type="button"
                  aria-pressed={reason === value}
                  onClick={() => setReason(value)}
                  className={`tap w-full rounded-[4px] border px-3 py-2 text-left ${
                    reason === value ? 'border-pista bg-pista text-linea' : 'border-borde'
                  }`}
                >
                  {copy.safety.reportReasons[value]}
                </button>
              </li>
            ))}
          </ul>
          <Field label={copy.safety.reportDetail}>
            {(props) => (
              <textarea
                {...props}
                className={`${inputClass} min-h-20`}
                placeholder={copy.safety.reportDetailPlaceholder}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={1000}
              />
            )}
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setView('menu')}>
              {copy.common.back}
            </Button>
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await attempt(() =>
                    submitReport({
                      reason,
                      detail: detail.trim() || null,
                      subjectUser: userId,
                      subjectPlan: planId ?? null,
                      subjectMessage: messageId ?? null,
                    }),
                  );
                  if (result.ok) setView('sent');
                  else setError(result.error);
                })
              }
            >
              {copy.safety.reportSubmit}
            </Button>
          </div>
        </div>
      ) : null}

      {view === 'block' ? (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">{copy.safety.blockConfirm(displayName)}</h3>
          <p className="text-[15px] text-tinta-60">{copy.safety.blockExplain}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setView('menu')}>
              {copy.common.cancel}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await attempt(() => blockUser(userId));
                  if (!result.ok) return setError(result.error);
                  setShared('sharedPlanIds' in result ? result.sharedPlanIds : []);
                  setView('blocked');
                })
              }
            >
              {copy.safety.block}
            </Button>
          </div>
        </div>
      ) : null}

      {view === 'blocked' ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium">{copy.safety.blocked}</p>
          {shared.length > 0 ? (
            <>
              <p>{copy.safety.blockSharedPlans(shared.length)}</p>
              <p className="text-[15px] text-tinta-60">{copy.safety.blockLeaveFree}</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await attempt(() => leaveForSafety(shared));
                      if (result.ok) setView('closed');
                      else setError(result.error);
                    })
                  }
                >
                  {copy.safety.blockLeaveShared}
                </Button>
                <Button variant="secondary" onClick={() => setView('closed')}>
                  {copy.safety.blockStay}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setView('closed')}>
              {copy.common.close}
            </Button>
          )}
        </div>
      ) : null}

      {view === 'sent' ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{copy.safety.reportSent}</p>
          <Button variant="secondary" onClick={() => setView('closed')}>
            {copy.common.close}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
