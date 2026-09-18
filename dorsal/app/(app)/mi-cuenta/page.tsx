import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/server';
import { AccountPanel } from '@/features/account/account-panel';
import { PushPanel } from '@/features/push/push-panel';
import { InstallPrompt } from '@/features/pwa/install-prompt';
import { VerificationPanel } from '@/features/verification/verification-panel';
import { getMyReports } from '@/features/safety/queries';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: copy.account.title };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/entrar');

  // Read on the server so the page decides whether the feature exists at all.
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

  const [{ data: verification }, reports] = await Promise.all([
    supabase
      .from('verifications')
      .select('status')
      .eq('user_id', auth.user.id)
      .eq('kind', 'selfie')
      .maybeSingle(),
    getMyReports(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 pb-4">
      <h1 className="font-display text-2xl font-bold">{copy.account.title}</h1>

      <InstallPrompt />

      {/* Absent rather than broken where the deployment has no VAPID keys:
          offering a switch that cannot be flipped is worse than no switch. */}
      {vapidPublicKey ? <PushPanel vapidPublicKey={vapidPublicKey} /> : null}

      <VerificationPanel initialStatus={verification?.status ?? null} />

      {reports.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-bold">{copy.safety.myReports}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {reports.map((report) => (
              <li key={report.id} className="border border-borde bg-linea p-3">
                <p className="font-medium">{copy.safety.reportReasons[report.reason]}</p>
                <p className="text-[15px] text-tinta-60" data-numeric>
                  {formatShortDate(report.createdAt)} · {copy.safety.reportStatus[report.status]}
                </p>
                {report.resolution ? <p className="mt-1">{report.resolution}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AccountPanel />

      <nav className="flex flex-wrap gap-3 border-t border-borde pt-3 text-[15px]">
        {(['aviso', 'privacidad', 'cookies', 'condiciones'] as const).map((page) => (
          <Link key={page} href={`/legal/${page}`} className="text-pista underline underline-offset-4">
            {copy.legal[page]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
