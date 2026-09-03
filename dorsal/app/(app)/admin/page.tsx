import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';
import { formatShortDate } from '@/lib/time';
import { isAdmin } from '@/features/safety/queries';
import { ModerationQueue } from '@/features/safety/moderation-queue';

export const metadata: Metadata = { title: copy.admin.title, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Not a 403: someone who is not a moderator has no business knowing this
  // screen exists, and the queue's contents are the most sensitive rows here.
  if (!(await isAdmin())) notFound();

  const supabase = await createClient();

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
