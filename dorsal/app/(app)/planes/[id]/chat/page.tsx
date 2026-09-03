import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import { formatWhen } from '@/lib/time';
import { ChatClient } from '@/features/chat/chat-client';
import { getChat } from '@/features/chat/queries';
import { getPlan, getRoster, getViewer } from '@/features/plans/queries';

export const metadata: Metadata = { title: copy.chat.title };
export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect('/alta');

  const [plan, chat, roster] = await Promise.all([
    getPlan(id),
    getChat(id, viewer.id),
    getRoster(id),
  ]);

  // Not in the plan, not the host: the thread is not found, in exactly the same
  // way a plan you cannot see is not found. Saying "you are not a participant"
  // would confirm the thread exists.
  if (!plan || !chat.canUse) notFound();

  const names: Record<string, { name: string; dorsal: number }> = plan.host
    ? { [plan.host.id]: { name: plan.host.displayName, dorsal: plan.host.dorsalNumber } }
    : {};
  for (const person of roster) {
    names[person.userId] = { name: person.displayName, dorsal: person.dorsalNumber };
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-3">
        <Link href={`/planes/${id}`} className="text-[15px] text-pista underline underline-offset-4">
          {copy.common.back}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">
          {getSport(plan.sport).label}
          <span className="ml-2 font-normal text-tinta-60" data-numeric>
            {formatWhen(plan.startsAt)}
          </span>
        </h1>
      </header>

      <ChatClient
        planId={id}
        viewerId={viewer.id}
        isHost={chat.isHost}
        isOpen={chat.isOpen}
        closesAt={chat.closesAt}
        initialMessages={chat.messages}
        names={names}
      />
    </div>
  );
}
