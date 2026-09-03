import { copy, formatThirdHalf } from '@/lib/copy/es-ES';
import { formatDayTag, formatTime } from '@/lib/time';
import { getSport } from '@/lib/levels';
import type { PlanCardData } from '@/features/plans/queries';

/**
 * The plan card. The whole product in one object: someone on the metro decides
 * in under two seconds, so the order is when → what → where → level → después →
 * plazas. See docs/DESIGN-TOKENS.md for why it is painted rather than floating.
 */
export function PlanCard({ plan, compact = false }: { plan: PlanCardData; compact?: boolean }) {
  const remaining = Math.max(0, plan.capacity - plan.joinedCount);
  const sport = getSport(plan.sport);

  return (
    <article className="painted flex h-full flex-col p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-extrabold leading-none" data-numeric>
            {formatDayTag(plan.startsAt)}
            <span className="mx-2 font-normal text-tinta-60">·</span>
            <time dateTime={plan.startsAt}>{formatTime(plan.startsAt)}</time>
          </p>
          <p className="mt-1 font-display text-2xl font-bold leading-tight">{sport.label}</p>
        </div>
        {plan.audience === 'solo_mujeres' ? (
          <span className="rounded-[2px] border border-pista px-2 py-0.5 text-[13px] font-medium text-pista">
            {copy.plan.audience.solo_mujeres}
          </span>
        ) : null}
      </header>

      <p className="mt-3 text-[17px]">{plan.venue?.name ?? plan.distrito}</p>
      <p className="mt-1 text-tinta-60" data-numeric>
        {plan.levelDisplay}
      </p>

      {!compact ? (
        <p className="mt-4 font-medium">
          {formatThirdHalf(plan.thirdHalf, plan.thirdHalfVenueName)}
        </p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-borde pt-3">
        <div>
          <Plazas taken={plan.joinedCount} total={plan.capacity} />
          <p className={`mt-1 text-[15px] ${remaining === 0 ? 'text-tinta-60' : 'text-cesped'}`}>
            {remaining === 0
              ? copy.deck.remaining.full
              : remaining === 1
                ? copy.deck.remaining.last
                : copy.deck.remaining.some(remaining)}
          </p>
        </div>
        <p className="text-right text-[15px] text-tinta-60">
          {copy.plan.hostedBy(plan.host.displayName)}
        </p>
      </div>
    </article>
  );
}

/** ●●●●○○ 4 de 6 — glanceable, and readable by a screen reader as words. */
function Plazas({ taken, total }: { taken: number; total: number }) {
  return (
    <p className="flex items-center gap-2">
      <span aria-hidden="true" className="flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < taken ? 'bg-cesped' : 'border border-borde'}`}
          />
        ))}
      </span>
      <span className="font-display text-lg font-bold" data-numeric>
        {copy.deck.remaining.count(taken, total)}
      </span>
    </p>
  );
}
