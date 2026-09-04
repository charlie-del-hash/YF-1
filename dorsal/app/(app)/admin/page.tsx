import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';
import { formatShortDate } from '@/lib/time';
import { isAdmin } from '@/features/safety/queries';
import { getFillMetrics } from '@/features/plans/queries';
import { ModerationQueue } from '@/features/safety/moderation-queue';

export const metadata: Metadata = { title: copy.admin.title, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Not a 403: someone who is not a moderator has no business knowing this
  // screen exists, and the queue's contents are the most sensitive rows here.
  if (!(await isAdmin())) notFound();

  const supabase = await createClient();

  const metrics = await getFillMetrics();

  const [{ data: reports }, { data: verifications }] = await Promise.all([
    supabase
      .from('reports')
      .select('id, reason, detail, status, created_at, reporter_id, subject_user, subject_plan')
      .in('status', ['open', 'reviewing'])
      .order('created_at', { ascending: true }),
    supabase
      .from('verifications')
      .select('user_id, selfie_path, submitted_at')
      .eq('kind', 'selfie')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true }),
  ]);

  // Short-lived signed URLs, minted per page load. The bucket is private and
  // stays private; nothing about a selfie is ever a durable link.
  const pending = await Promise.all(
    (verifications ?? []).map(async (row) => {
      const { data: profile } = await supabase
        .from('public_profiles')
        .select('display_name, dorsal_number')
        .eq('id', row.user_id)
        .maybeSingle();

      let selfieUrl: string | null = null;
      if (row.selfie_path) {
        const { data: signed } = await supabase.storage
          .from('verificaciones')
          .createSignedUrl(row.selfie_path, 300);
        selfieUrl = signed?.signedUrl ?? null;
      }

      return {
        userId: row.user_id,
        displayName: profile?.display_name ?? '',
        dorsalNumber: profile?.dorsal_number ?? 0,
        submittedAt: formatShortDate(row.submitted_at),
        selfieUrl,
      };
    }),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 pb-4">
      <h1 className="font-display text-2xl font-bold">{copy.admin.title}</h1>

      {/* 04-BUILD-PLAN's definition of done for M5. Four numbers, computed by
          the database from rows we already keep — no analytics vendor, and so
          no third party receiving anybody's behaviour (05-RGPD §1). */}
      {metrics ? (
        <section>
          <h2 className="font-display text-xl font-bold">{copy.admin.metrics.title}</h2>
          <p className="mt-1 text-[15px] text-tinta-60">{copy.admin.metrics.help}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Metric label={copy.admin.metrics.created} value={String(metrics.plansCreated)} />
            <Metric label={copy.admin.metrics.filled} value={String(metrics.plansFilled)} />
            <Metric
              label={copy.admin.metrics.medianFill}
              value={
                metrics.medianHoursToFill === null
                  ? copy.admin.metrics.none
                  : copy.admin.metrics.hours(metrics.medianHoursToFill)
              }
            />
            <Metric
              label={copy.admin.metrics.medianNotice}
              value={
                metrics.medianHoursOfNotice === null
                  ? copy.admin.metrics.none
                  : copy.admin.metrics.hours(metrics.medianHoursOfNotice)
              }
            />
          </dl>
        </section>
      ) : null}

      <ModerationQueue
        reports={(reports ?? []).map((r) => ({
          id: r.id,
          reason: r.reason,
          detail: r.detail,
          createdAt: formatShortDate(r.created_at),
          subjectUser: r.subject_user,
          subjectPlan: r.subject_plan,
        }))}
        verifications={pending}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="painted p-3">
      <dt className="text-[15px] text-tinta-60">{label}</dt>
      <dd className="font-display text-2xl font-bold" data-numeric>
        {value}
      </dd>
    </div>
  );
}
