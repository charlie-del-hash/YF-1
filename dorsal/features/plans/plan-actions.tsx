'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { cancelPlan, leavePlan } from './actions';

/**
 * Leaving.
 *
 * `cost` comes from the database (leave_cost), not from a clock in the browser,
 * so the sentence someone agrees to is the same rule that will be written to
 * their reliability history. The confirmation is a real step: under twelve
 * hours this counts against them and they should be told before, not after.
 */
export function LeaveButton({
  planId,
  cost,
}: {
  planId: string;
  cost: 'early_cancel' | 'late_cancel';
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        {error ? (
          <p role="alert" className="text-aviso">
            {error}
          </p>
        ) : null}
        <Button variant="destructive" className="w-full" onClick={() => setConfirming(true)}>
          {copy.plan.leave}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-borde bg-linea p-3">
      <p>{cost === 'late_cancel' ? copy.plan.leaveConfirmLate : copy.plan.leaveConfirmEarly}</p>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
          {copy.plan.leaveCancel}
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await attempt(() => leavePlan(planId));
              if (!result.ok) {
                setConfirming(false);
                setError(result.error);
                return;
              }
              router.replace('/mis-planes');
              router.refresh();
            })
          }
        >
          {copy.plan.leaveConfirm}
        </Button>
      </div>
    </div>
  );
}

/**
 * What the host can do. Cancelling needs a reason — the database refuses
 * without one — because until web push lands in M2 the reason is the only thing
 * the people who had made plans actually receive.
 */
export function HostControls({ planId }: { planId: string }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {!cancelling ? (
        <div className="flex gap-3">
          <Link
            href={`/planes/${planId}/editar`}
            className="tap inline-flex flex-1 items-center justify-center rounded-[4px] border border-borde bg-linea px-4 font-medium"
          >
            {copy.plan.edit}
          </Link>
          <Button variant="destructive" className="flex-1" onClick={() => setCancelling(true)}>
            {copy.plan.cancelPlan}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border border-borde bg-linea p-3">
          <h2 className="font-display text-xl font-bold">{copy.plan.cancelTitle}</h2>
          <Field label={copy.plan.cancelReasonLabel} help={copy.plan.cancelHelp} error={error}>
            {(props) => (
              <input
                {...props}
                className={inputClass}
                placeholder={copy.plan.cancelReasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            )}
          </Field>
          <p className="text-[15px] text-tinta-60">{copy.plan.notifyPending}</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelling(false)}>
              {copy.plan.cancelKeep}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending || reason.trim().length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await attempt(() => cancelPlan(planId, reason));
                  if (!result.ok) return setError(result.error);
                  setCancelling(false);
                  router.refresh();
                })
              }
            >
              {copy.plan.cancelConfirm}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
