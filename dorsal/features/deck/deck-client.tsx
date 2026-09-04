'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PlanCard } from '@/components/plan-card';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { formatDayTag } from '@/lib/time';
import { joinPlan, passPlan } from '@/features/plans/actions';
import type { PlanCardData } from '@/features/plans/queries';

type Toast = { tone: 'ok' | 'error'; text: string; chatPlanId?: string } | null;
type View = 'cards' | 'list';

const COMMIT_DISTANCE = 96;

/**
 * The deck.
 *
 * Two views over one queue and one action. The card stack is the briefed
 * interaction; the list exists because a swipe deck is built for abundant
 * interchangeable inventory and sports plans are none of those things — they
 * are scarce, perishable and constrained by time, place and level. The design
 * brief already requires the deck to be fully operable without gestures, so the
 * list costs almost nothing and lets the two be compared with real users
 * instead of argued about.
 *
 * `Me apunto` means the same thing in both, and both go through the same
 * server action, which goes through join_plan().
 */
export function DeckClient({
  plans,
  needPeople = [],
}: {
  plans: PlanCardData[];
  /** Close, short of people, and worth a second look. See migration 0008. */
  needPeople?: PlanCardData[];
}) {
  const [queue, setQueue] = useState(plans);
  const [toast, setToast] = useState<Toast>(null);
  const [view, setView] = useState<View>('cards');
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQueue(plans), [plans]);

  useEffect(() => {
    const stored = window.localStorage.getItem('dorsal:deck-view');
    if (stored === 'list' || stored === 'cards') setView(stored);
  }, []);

  function chooseView(next: View) {
    setView(next);
    window.localStorage.setItem('dorsal:deck-view', next);
  }

  const commit = useCallback(
    (plan: PlanCardData, direction: 'right' | 'left') => {
      setQueue((q) => q.filter((p) => p.id !== plan.id));
      setToast(null);

      startTransition(async () => {
        if (direction === 'left') {
          const result = await attempt(() => passPlan(plan.id));
          if (!result.ok) setQueue((q) => [plan, ...q]);
          return;
        }

        const result = await attempt(() => joinPlan(plan.id, plan.minPlansRequired));
        if (result.ok && 'status' in result) {
          setToast({
            tone: 'ok',
            text:
              result.status === 'waitlist'
                ? copy.deck.waitlisted
                : copy.deck.joinedToastWithDay(formatDayTag(plan.startsAt).toLowerCase()),
            // Joining opens the thread; this is the shortest path from "I'm in"
            // to agreeing where exactly to meet, which is the point of the plan.
            chatPlanId: result.status === 'joined' ? plan.id : undefined,
          });
        } else {
          // Put it back: the person did not choose to pass on it.
          setQueue((q) => [plan, ...q]);
          setToast({ tone: 'error', text: result.error });
        }
      });
    },
    [],
  );

  const top = queue[0];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!top) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      commit(top, 'right');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commit(top, 'left');
    }
  };

  // The end of the deck is exactly where a plan someone passed on earns
  // another look: there is nothing else to show them, and the plan being short
  // of people two days out is new information rather than a second guess at
  // the same question. It is the only place this list appears.
  if (queue.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <EmptyState
          title={plans.length === 0 ? copy.deck.empty.title : copy.deck.exhausted.title}
          body={plans.length === 0 ? copy.deck.empty.body : copy.deck.exhausted.body}
        />
        {needPeople.length > 0 ? (
          <section>
            <h2 className="font-display text-xl font-bold">{copy.deck.needPeople.title}</h2>
            <p className="mt-1 text-tinta-60">{copy.deck.needPeople.body}</p>
            <ul className="mt-3 flex flex-col gap-3 pb-4">
              {needPeople.map((plan) => (
                <li key={plan.id}>
                  <Link href={`/planes/${plan.id}`} className="block">
                    <PlanCard plan={plan} compact />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{copy.deck.title}</h1>
        <Button
          variant="quiet"
          className="px-1 text-[15px]"
          onClick={() => chooseView(view === 'cards' ? 'list' : 'cards')}
        >
          {view === 'cards' ? copy.deck.viewList : copy.deck.viewCards}
        </Button>
      </div>

      {toast ? (
        <p
          role="status"
          className={`mb-3 rounded-[4px] px-3 py-2 ${
            toast.tone === 'ok'
              ? 'bg-cesped text-linea'
              : 'border border-aviso bg-linea text-aviso'
          }`}
        >
          {toast.text}
          {toast.chatPlanId ? (
            <Link
              href={`/planes/${toast.chatPlanId}/chat`}
              className="ml-2 whitespace-nowrap underline underline-offset-4"
            >
              {copy.chat.open}
            </Link>
          ) : null}
        </p>
      ) : null}

      {view === 'cards' ? (
        <>
          <div
            ref={stackRef}
            role="group"
            tabIndex={0}
            aria-label={copy.deck.title}
            onKeyDown={onKeyDown}
            className="relative min-h-[26rem] flex-1 rounded-[4px] focus-visible:outline-3"
          >
            <AnimatePresence initial={false}>
              {queue
                .slice(0, 3)
                .reverse()
                .map((plan, reverseIndex, sliced) => {
                  const depth = sliced.length - 1 - reverseIndex;
                  return (
                    <SwipeableCard
                      key={plan.id}
                      plan={plan}
                      depth={depth}
                      isTop={depth === 0}
                      reduceMotion={Boolean(reduceMotion)}
                      onCommit={commit}
                    />
                  );
                })}
            </AnimatePresence>
          </div>

          <p className="mt-2 hidden text-[15px] text-tinta-60 sm:block">{copy.deck.keyboardHelp}</p>

          {/* Primary actions in the bottom third: this is used one-handed, and
              with prefers-reduced-motion they are the only way to act. */}
          <div className="sticky bottom-0 mt-3 flex gap-3 bg-cal pb-2 pt-3">
            <Button variant="secondary" className="flex-1" onClick={() => top && commit(top, 'left')}>
              {copy.deck.pass}
            </Button>
            <Link
              href={`/planes/${top?.id}`}
              className="tap inline-flex items-center justify-center rounded-[4px] border border-borde bg-linea px-4 text-[15px]"
            >
              {copy.deck.open}
            </Link>
            <Button className="flex-1" onClick={() => top && commit(top, 'right')}>
              {copy.deck.join}
            </Button>
          </div>
        </>
      ) : (
        <ul className="flex flex-col gap-3 pb-4">
          {queue.map((plan) => (
            <li key={plan.id}>
              <Link href={`/planes/${plan.id}`} className="block">
                <PlanCard plan={plan} compact />
              </Link>
              <div className="mt-2 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => commit(plan, 'left')}>
                  {copy.deck.pass}
                </Button>
                <Button className="flex-1" onClick={() => commit(plan, 'right')}>
                  {copy.deck.join}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SwipeableCard({
  plan,
  depth,
  isTop,
  reduceMotion,
  onCommit,
}: {
  plan: PlanCardData;
  depth: number;
  isTop: boolean;
  reduceMotion: boolean;
  onCommit: (plan: PlanCardData, direction: 'right' | 'left') => void;
}) {
  const [edge, setEdge] = useState<'right' | 'left' | null>(null);

  return (
    <motion.div
      className="absolute inset-x-0 top-0"
      style={{ zIndex: 10 - depth }}
      initial={reduceMotion ? { opacity: 0 } : { scale: 0.96, y: 12 * depth, opacity: 0 }}
      animate={
        reduceMotion
          ? { opacity: 1 }
          : { scale: 1 - depth * 0.03, y: depth * 10, opacity: depth > 1 ? 0.6 : 1 }
      }
      exit={reduceMotion ? { opacity: 0 } : { x: edge === 'left' ? -400 : 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
      drag={isTop && !reduceMotion ? 'x' : false}
      dragElastic={0.12}
      dragConstraints={{ left: 0, right: 0 }}
      onDrag={(_, info) =>
        setEdge(info.offset.x > 40 ? 'right' : info.offset.x < -40 ? 'left' : null)
      }
      onDragEnd={(_, info) => {
        const direction = info.offset.x > COMMIT_DISTANCE ? 'right' : info.offset.x < -COMMIT_DISTANCE ? 'left' : null;
        setEdge(null);
        if (direction) onCommit(plan, direction);
      }}
    >
      <div
        className={`relative ${isTop ? 'shadow-[0_6px_18px_-10px_rgba(7,27,42,0.55)]' : ''}`}
        style={edge === 'right' ? { boxShadow: 'inset 6px 0 0 0 var(--color-cesped)' } : undefined}
      >
        <PlanCard plan={plan} />
        {/* Right = a green edge and one word. Not a celebration. */}
        {edge === 'right' ? (
          <span className="pointer-events-none absolute right-4 top-4 bg-cesped px-2 py-1 font-display text-xl font-extrabold text-linea">
            {copy.deck.joined}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="painted flex flex-1 flex-col items-start justify-center gap-2 p-6">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="text-tinta-60">{body}</p>
    </div>
  );
}
