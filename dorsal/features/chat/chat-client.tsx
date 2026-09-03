'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';
import { formatLongDate, formatTime, madridDateAndTime } from '@/lib/time';
import { SafetyMenu } from '@/features/safety/safety-menu';
import { deleteMessage, markChatRead, pinMessage, sendMessage, unpinMessage } from './actions';
import type { ChatMessage } from './queries';

/**
 * The plan thread.
 *
 * Realtime carries the row but not the author's name, so names come from a map
 * seeded on the server and topped up on demand. Supabase applies the same RLS
 * policies to Realtime as to a query, so a non-participant is not subscribed to
 * anything — the filter here is for the right thread, not for permission.
 */
export function ChatClient({
  planId,
  viewerId,
  isHost,
  isOpen,
  closesAt,
  initialMessages,
  names,
}: {
  planId: string;
  viewerId: string;
  isHost: boolean;
  isOpen: boolean;
  closesAt: string | null;
  initialMessages: ChatMessage[];
  names: Record<string, { name: string; dorsal: number }>;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [authors, setAuthors] = useState(names);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const nameOf = useCallback(
    (userId: string | null, fallback: string) => {
      // 0007 keeps the words and drops the author when an account is deleted.
      if (userId === null) return copy.chat.deletedAuthor;
      return userId === viewerId ? copy.chat.you : (authors[userId]?.name ?? fallback);
    },
    [authors, viewerId],
  );

  // Fetch a name we have never seen — someone who joined after this page was
  // rendered and wrote before it was refreshed.
  const learnAuthor = useCallback(async (userId: string) => {
    // A name we cannot fetch shows as the fallback. Throwing here would throw
    // inside a Realtime handler, where nothing would catch it.
    try {
      const { data } = await createClient()
        .from('public_profiles')
        .select('display_name, dorsal_number')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        setAuthors((prev) => ({
          ...prev,
          [userId]: { name: data.display_name, dorsal: data.dorsal_number },
        }));
      }
    } catch {
      /* keep the fallback name */
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`plan:${planId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `plan_id=eq.${planId}` },
        (payload) => {
          const row = payload.new as ChatMessage & { user_id: string; is_pinned: boolean };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    userId: row.user_id,
                    body: row.body,
                    isPinned: row.is_pinned,
                    createdAt: row.createdAt ?? new Date().toISOString(),
                    authorName: '',
                    authorDorsal: null,
                  },
                ],
          );
          if (row.user_id !== viewerId && !authors[row.user_id]) void learnAuthor(row.user_id);
          if (row.user_id !== viewerId) void attempt(() => markChatRead(planId));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `plan_id=eq.${planId}` },
        (payload) => {
          const gone = (payload.old as { id?: string }).id;
          if (gone) setMessages((prev) => prev.filter((m) => m.id !== gone));
        },
      )
      .subscribe();

    return () => {
      // removeChannel rejects if the socket already went away; the page is
      // unmounting either way.
      void supabase.removeChannel(channel).catch(() => {});
    };
  }, [planId, viewerId, authors, learnAuthor]);

  useEffect(() => {
    void attempt(() => markChatRead(planId));
  }, [planId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const pinned = useMemo(() => messages.find((m) => m.isPinned), [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setError(undefined);
    setSending(true);
    const result = await attempt(() => sendMessage(planId, body));
    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft('');
    // Realtime echoes the insert back; if it is slow, this shows it anyway and
    // the echo is de-duplicated by id.
    if ('id' in result) {
      setMessages((prev) =>
        prev.some((m) => m.id === result.id)
          ? prev
          : [
              ...prev,
              {
                id: result.id,
                userId: viewerId,
                body,
                isPinned: false,
                createdAt: new Date().toISOString(),
                authorName: copy.chat.you,
                authorDorsal: null,
              },
            ],
      );
    }
  }

  let lastDay = '';

  return (
    <div className="flex flex-1 flex-col">
      {pinned ? (
        <div className="mb-3 border-l-4 border-pista bg-linea p-3">
          <p className="font-display text-sm font-bold text-pista">{copy.chat.pinned}</p>
          <p className="mt-1">{pinned.body}</p>
          {isHost ? (
            <Button
              variant="quiet"
              className="mt-1 px-0 text-[15px]"
              onClick={() => startTransition(async () => void (await attempt(() => unpinMessage(planId))))}
            >
              {copy.chat.unpin}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-1 flex-col gap-3">
        {messages.length === 0 ? (
          <li className="painted p-4">
            <p className="font-medium">{copy.chat.emptyTitle}</p>
            <p className="mt-1 text-tinta-60">
              {isHost ? copy.chat.emptyHost : copy.chat.emptyBody}
            </p>
          </li>
        ) : null}

        {messages.map((message) => {
          const day = madridDateAndTime(message.createdAt).date;
          const newDay = day !== lastDay;
          lastDay = day;
          const mine = message.userId === viewerId;

          return (
            <li key={message.id}>
              {newDay ? (
                <p className="my-2 text-center text-[15px] text-tinta-60">
                  {formatLongDate(message.createdAt)}
                </p>
              ) : null}
              <div className={mine ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                <p className="text-[15px] text-tinta-60">
                  <span className="font-medium">{nameOf(message.userId, message.authorName)}</span>
                  <span className="mx-1">·</span>
                  <time dateTime={message.createdAt} data-numeric>
                    {formatTime(message.createdAt)}
                  </time>
                </p>
                <p
                  className={`max-w-[85%] rounded-[4px] px-3 py-2 ${
                    mine ? 'bg-pista text-linea' : 'border border-borde bg-linea'
                  }`}
                >
                  {message.body}
                </p>
                <span className="flex gap-3">
                  {isHost && !message.isPinned ? (
                    <Button
                      variant="quiet"
                      className="px-0 text-[13px]"
                      onClick={() =>
                        startTransition(
                          async () => void (await attempt(() => pinMessage(planId, message.id))),
                        )
                      }
                    >
                      {copy.chat.pin}
                    </Button>
                  ) : null}
                  {!mine && message.userId ? (
                    <SafetyMenu
                      userId={message.userId}
                      displayName={nameOf(message.userId, message.authorName)}
                      planId={planId}
                      messageId={message.id}
                    />
                  ) : null}
                  {mine ? (
                    <Button
                      variant="quiet"
                      className="px-0 text-[13px]"
                      onClick={() =>
                        startTransition(async () => {
                          const gone = await attempt(() => deleteMessage(planId, message.id));
                          if (gone.ok) setMessages((p) => p.filter((m) => m.id !== message.id));
                        })
                      }
                    >
                      {copy.chat.delete}
                    </Button>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
        <div ref={bottom} />
      </ul>

      {error ? (
        <p role="alert" className="mt-2 text-aviso">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 bg-cal pb-2 pt-3">
        {isOpen ? (
          <form onSubmit={send} className="flex gap-2">
            <label className="sr-only" htmlFor="chat-draft">
              {copy.chat.placeholder}
            </label>
            <input
              id="chat-draft"
              className="tap flex-1 rounded-[4px] border border-borde bg-linea px-3 py-2.5 text-[16px]"
              placeholder={copy.chat.placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              autoComplete="off"
            />
            <Button type="submit" disabled={sending || draft.trim().length === 0}>
              {sending ? copy.chat.sending : copy.chat.send}
            </Button>
          </form>
        ) : (
          <p className="rounded-[4px] border border-borde bg-linea px-3 py-2 text-tinta-60">
            {copy.chat.closed}
          </p>
        )}
        <p className="mt-2 text-[15px] text-tinta-60">
          {isOpen && closesAt ? copy.chat.closesAfter : copy.chat.onlyThisPlan}
        </p>
      </div>
    </div>
  );
}
