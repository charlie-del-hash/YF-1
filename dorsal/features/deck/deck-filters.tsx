'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { getSport } from '@/lib/levels';
import type { SportKey } from '@/lib/sports';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  serialiseFilters,
  type DeckFilters,
} from './filters';

/**
 * Filters, written to the URL.
 *
 * Collapsed by default: the deck is the screen, and a filter bar that takes a
 * third of a 390px viewport before anyone has seen a plan is a worse default
 * than one tap. The count on the toggle is there so an unexpectedly empty deck
 * is legible as "you filtered it", not "there is nothing".
 *
 * `Solo mujeres` only exists for someone who can see those plans at all — the
 * RLS policy already hides them, and offering a filter that can only ever
 * return nothing is a worse answer than not offering it.
 */
export function DeckFilterBar({
  filters,
  sports,
  canSeeWomenOnly,
}: {
  filters: DeckFilters;
  sports: SportKey[];
  canSeeWomenOnly: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(activeFilterCount(filters) > 0);
  const [, startTransition] = useTransition();
  const active = activeFilterCount(filters);

  function apply(next: Partial<DeckFilters>) {
    const merged = { ...filters, ...next };
    const query = serialiseFilters(merged).toString();
    startTransition(() => router.push(query ? `/planes?${query}` : '/planes'));
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="px-3 py-1.5"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {active > 0 ? copy.deck.filters.active(active) : copy.deck.filters.title}
        </Button>
        {active > 0 ? (
          <Button variant="quiet" className="px-1 text-[15px]" onClick={() => apply(DEFAULT_FILTERS)}>
            {copy.deck.filters.clear}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 flex flex-col gap-3 border border-borde bg-linea p-3">
          <Select
            label={copy.deck.filters.sport}
            value={filters.sport ?? ''}
            onChange={(value) => apply({ sport: value === '' ? null : (value as SportKey) })}
            options={[
              { value: '', label: copy.deck.filters.any },
              ...sports.map((key) => ({ value: key, label: getSport(key).label })),
            ]}
          />
          <Select
            label={copy.deck.filters.when}
            value={filters.when}
            onChange={(value) => apply({ when: value as DeckFilters['when'] })}
            options={Object.entries(copy.deck.filters.whenOptions).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            label={copy.deck.filters.timeOfDayLabel}
            value={filters.timeOfDay}
            onChange={(value) => apply({ timeOfDay: value as DeckFilters['timeOfDay'] })}
            options={Object.entries(copy.deck.filters.timeOfDay).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            label={copy.deck.filters.level}
            value={filters.level}
            onChange={(value) => apply({ level: value as DeckFilters['level'] })}
            options={[
              { value: 'mine', label: copy.deck.filters.levelOptions.mine },
              { value: 'all', label: copy.deck.filters.levelOptions.all },
            ]}
          />

          <div className="flex flex-wrap gap-2">
            <Toggle
              label={copy.deck.filters.withThirdHalf}
              on={filters.withThirdHalf}
              onClick={() => apply({ withThirdHalf: !filters.withThirdHalf })}
            />
            {canSeeWomenOnly ? (
              <Toggle
                label={copy.deck.filters.womenOnly}
                on={filters.womenOnly}
                onClick={() => apply({ womenOnly: !filters.womenOnly })}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  // Explicitly associated rather than wrapping the control: a <label> wrapped
  // around a <select> takes its accessible name from the label's whole text
  // content, which drags the option text in with it.
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        className="tap min-w-40 rounded-[4px] border border-borde bg-linea px-2 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`tap rounded-[4px] border px-3 py-2 ${
        on ? 'border-pista bg-pista text-linea' : 'border-borde bg-linea text-tinta'
      }`}
    >
      {label}
    </button>
  );
}
