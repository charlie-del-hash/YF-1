'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { attempt } from '@/lib/actions';
import { copy } from '@/lib/copy/es-ES';
import type { ReportReason } from '@/lib/database.types';
import { moderateAction, type ModerationInput } from './admin-actions';

export interface QueueReport {
  id: string;
  reason: ReportReason;
  detail: string | null;
  createdAt: string;
  subjectUser: string | null;
  subjectPlan: string | null;
}

export interface QueueVerification {
  userId: string;
  displayName: string;
  dorsalNumber: number;
  submittedAt: string;
  selfieUrl: string | null;
}

/**
 * The human queue. Every action needs a reason typed by the person taking it,
 * because 05-RGPD asks for who, what and why, and because a moderation log
 * without a why is not a log — it is a list of things that happened to people.
 */
export function ModerationQueue({
  reports,
  verifications,
}: {
  reports: QueueReport[];
  verifications: QueueVerification[];
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [handled, setHandled] = useState<Record<string, true>>({});
  const [busy, startTransition] = useTransition();

  // The reason is typed once at the top and attached to whichever action is
  // taken, so `args` here is everything except that.
  const run = (key: string, args: Omit<ModerationInput, 'reason'>) =>
    startTransition(async () => {
      setError(undefined);
      if (reason.trim().length === 0) return setError(copy.admin.reasonPlaceholder);
      const result = await attempt(() => moderateAction({ ...args, reason }));
      if (result.ok) {
        setHandled((h) => ({ ...h, [key]: true }));
        setReason('');
      } else setError(result.error);
    });

  const openReports = reports.filter((r) => !handled[`r:${r.id}`]);
  const openVerifications = verifications.filter((v) => !handled[`v:${v.userId}`]);

  return (
    <div className="flex flex-col gap-6">
      <Field label={copy.admin.reasonLabel}>
        {(props) => (
          <input
            {...props}
            className={inputClass}
            placeholder={copy.admin.reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        )}
      </Field>
      {error ? (
        <p role="alert" className="text-aviso">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="font-display text-xl font-bold">{copy.admin.reports}</h2>
        {openReports.length === 0 ? (
          <p className="mt-2 text-tinta-60">{copy.admin.empty}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {openReports.map((report) => (
              <li key={report.id} className="border border-borde bg-linea p-3">
                <p className="font-medium">{copy.safety.reportReasons[report.reason]}</p>
                <p className="text-[15px] text-tinta-60" data-numeric>
                  {report.createdAt}
                </p>
                {report.detail ? <p className="mt-1">{report.detail}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-[15px]"
                    disabled={busy}
                    onClick={() => run(`r:${report.id}`, { action: 'dismiss_report', reportId: report.id })}
                  >
                    {copy.admin.dismiss}
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-[15px]"
                    disabled={busy}
                    onClick={() => run(`r:${report.id}`, { action: 'action_report', reportId: report.id })}
                  >
                    {copy.admin.action}
                  </Button>
                  {report.subjectUser ? (
                    <Button
                      variant="destructive"
                      className="px-3 py-1.5 text-[15px]"
                      disabled={busy}
                      onClick={() =>
                        run(`r:${report.id}`, {
                          action: 'suspend_user',
                          userId: report.subjectUser!,
                          reportId: report.id,
                        })
                      }
                    >
                      {copy.admin.suspend}
                    </Button>
                  ) : null}
                  {report.subjectPlan ? (
                    <Button
                      variant="destructive"
                      className="px-3 py-1.5 text-[15px]"
                      disabled={busy}
                      onClick={() =>
                        run(`r:${report.id}`, {
                          action: 'remove_plan',
                          planId: report.subjectPlan!,
                          reportId: report.id,
                        })
                      }
                    >
                      {copy.admin.removePlan}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">{copy.admin.verifications}</h2>
        {openVerifications.length === 0 ? (
          <p className="mt-2 text-tinta-60">{copy.admin.empty}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {openVerifications.map((person) => (
              <li key={person.userId} className="border border-borde bg-linea p-3">
                <p className="font-medium">
                  {person.displayName}{' '}
                  <span className="text-tinta-60" data-numeric>
                    {person.dorsalNumber} · {person.submittedAt}
                  </span>
                </p>
                {person.selfieUrl ? (
                  <Image
                    src={person.selfieUrl}
                    alt=""
                    width={200}
                    height={200}
                    unoptimized
                    className="mt-2 rounded-[4px] border border-borde"
                  />
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button
                    className="px-3 py-1.5 text-[15px]"
                    disabled={busy}
                    onClick={() =>
                      run(`v:${person.userId}`, { action: 'approve_selfie', userId: person.userId })
                    }
                  >
                    {copy.admin.approve}
                  </Button>
                  <Button
                    variant="destructive"
                    className="px-3 py-1.5 text-[15px]"
                    disabled={busy}
                    onClick={() =>
                      run(`v:${person.userId}`, { action: 'reject_selfie', userId: person.userId })
                    }
                  >
                    {copy.admin.reject}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
