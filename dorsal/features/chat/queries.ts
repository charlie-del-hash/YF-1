import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface ChatMessage {
  id: string;
  /** null when the author deleted their account. The message stays. */
  userId: string | null;
  body: string;
  isPinned: boolean;
  createdAt: string;
  authorName: string;
  authorDorsal: number | null;
}

export interface ChatState {
  planId: string;
  canUse: boolean;
  isOpen: boolean;
  isHost: boolean;
  closesAt: string | null;
  messages: ChatMessage[];
}

type Raw = {
  id: string;
  user_id: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
  author: { display_name: string; dorsal_number: number } | null;
};

const SELECT = `
  id, user_id, body, is_pinned, created_at,
  author:public_profiles!messages_user_id_fkey ( display_name, dorsal_number )
`;

/**
 * The thread, oldest first.
 *
 * Nothing here filters by membership: `messages_read` does that, and doing it
 * twice would invite the two to disagree. A caller who may not read this thread
 * gets an empty list from the database, not from an `if` in this file.
 */
export async function getChat(planId: string, viewerId: string): Promise<ChatState> {
  const supabase = await createClient();

  const [{ data: rows }, { data: canUse }, { data: isOpen }, { data: closesAt }, { data: plan }] =
    await Promise.all([
      supabase.from('messages').select(SELECT).eq('plan_id', planId).order('created_at'),
      supabase.rpc('can_use_chat', { p_plan: planId }),
      supabase.rpc('chat_is_open', { p_plan: planId }),
      supabase.rpc('chat_closes_at', { p_plan: planId }),
      supabase.from('plans').select('host_id').eq('id', planId).maybeSingle(),
    ]);

  return {
    planId,
    canUse: canUse === true,
    isOpen: isOpen === true,
    isHost: plan?.host_id === viewerId,
    closesAt: (closesAt as string | null) ?? null,
    messages: ((rows ?? []) as unknown as Raw[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      body: row.body,
      isPinned: row.is_pinned,
      createdAt: row.created_at,
      // A suspended or blocked author is filtered out of public_profiles but
      // their message may still be readable; it shows without a name rather
      // than crashing the thread.
      authorName: row.author?.display_name ?? '',
      authorDorsal: row.author?.dorsal_number ?? null,
    })),
  };
}

/** Unread counts for every chat the viewer can use, keyed by plan. */
export async function getUnreadCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_unread_counts');
  const rows = (data ?? []) as { plan_id: string; unread: number }[];
  return new Map(rows.filter((r) => r.unread > 0).map((r) => [r.plan_id, r.unread]));
}
