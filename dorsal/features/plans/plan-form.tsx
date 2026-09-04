'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { VenueMapPicker } from '@/components/venue-map-picker';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { bandsFor, formatLevelRange } from '@/lib/levels';
import { DISTRITOS, LAUNCH_SPORTS, SPORTS, type SportKey } from '@/lib/sports';
import { formatLongDate, formatTime, madridDateAndTime, madridInstant } from '@/lib/time';
import { reservedPlazas } from '@/features/reliability/palabra';
import { createVenue, savePlan } from './actions';
import { DURATIONS, THIRD_HALVES, type PlanFormInput } from './schema';
import type { VenueOption } from './queries';

export interface PlanFormDefaults {
  id?: string;
  sport: SportKey;
  startsAt?: string;
  durationMin: number;
  venueId: string | null;
  thirdHalfVenueId: string | null;
  levelMin: number;
  levelMax: number;
  capacity: number;
  minPlansRequired: number;
  thirdHalf: (typeof THIRD_HALVES)[number];
  audience: 'todos' | 'solo_mujeres';
  repeatWeekly: boolean;
  meetingNote: string | null;
}

/**
 * One scrolling form, not a wizard. 01-PRD wants a repeat host creating next
 * week's plan in under thirty seconds, and a wizard costs four taps before a
 * single field is filled. Everything is prefilled with the most likely answer.
 */
export function PlanForm({
  defaults,
  venues: initialVenues,
  mySports,
  myDistrito,
  canCreateWomenOnly,
  center,
  initialDate,
  initialTime,
}: {
  defaults: PlanFormDefaults;
  venues: VenueOption[];
  mySports: SportKey[];
  myDistrito: string;
  canCreateWomenOnly: boolean;
  center: { lat: number; lng: number };
  /** Prefilled when creating; the plan's own date wins when editing. */
  initialDate?: string;
  /** Only set when copying a plan, so the hour carries over with the rest. */
  initialTime?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(defaults.id);
  const prefill = defaults.startsAt ? madridDateAndTime(defaults.startsAt) : null;

  const [venues, setVenues] = useState(initialVenues);
  const [sport, setSport] = useState<SportKey>(defaults.sport);
  const [date, setDate] = useState(prefill?.date ?? initialDate ?? '');
  const [time, setTime] = useState(prefill?.time ?? initialTime ?? '19:30');
  const [durationMin, setDurationMin] = useState(defaults.durationMin);
  const [venueId, setVenueId] = useState(defaults.venueId ?? '');
  const [levelMin, setLevelMin] = useState(defaults.levelMin);
  const [levelMax, setLevelMax] = useState(defaults.levelMax);
  const [capacity, setCapacity] = useState(defaults.capacity);
  const [minPlansRequired, setMinPlansRequired] = useState(defaults.minPlansRequired);
  const [thirdHalf, setThirdHalf] = useState(defaults.thirdHalf);
  const [thirdHalfVenueId, setThirdHalfVenueId] = useState(defaults.thirdHalfVenueId ?? '');
  const [audience, setAudience] = useState(defaults.audience);
  const [repeatWeekly, setRepeatWeekly] = useState(defaults.repeatWeekly);
  const [meetingNote, setMeetingNote] = useState(defaults.meetingNote ?? '');

  const [pinning, setPinning] = useState(false);
  const [pinName, setPinName] = useState('');
  const [pinDistrito, setPinDistrito] = useState(myDistrito);
  const [pinPoint, setPinPoint] = useState(center);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const bands = bandsFor(sport);
  const sportOptions = useMemo(
    () => [
      ...SPORTS.filter((s) => mySports.includes(s.key)),
      ...SPORTS.filter((s) => !mySports.includes(s.key) && LAUNCH_SPORTS.includes(s.key)),
    ],
    [mySports],
  );
  const cafes = venues.filter((v) => v.kind === 'cafe');

  async function addPinnedVenue() {
    setError(undefined);
    const result = await attempt(() =>
      createVenue({
        name: pinName,
        distrito: pinDistrito,
        lat: pinPoint.lat,
        lng: pinPoint.lng,
      }),
    );
    if (!result.ok) return setError(result.error);
    if (!('id' in result)) return setError(copy.errors.save);

    setVenues((prev) => [
      ...prev,
      {
        id: result.id, name: pinName, kind: 'otro', distrito: pinDistrito,
        lat: pinPoint.lat, lng: pinPoint.lng, verified: false,
      },
    ]);
    setVenueId(result.id);
    setPinning(false);
    setPinName('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!date) return setError(copy.create.errors.past);
    if (!venueId) return setError(copy.create.errors.venue);
    if (levelMin > levelMax) return setError(copy.create.errors.levelOrder);

    const input: PlanFormInput = {
      sport, date, time, durationMin, venueId,
      thirdHalfVenueId: thirdHalf === 'ninguno' || !thirdHalfVenueId ? null : thirdHalfVenueId,
      levelMin, levelMax, capacity, minPlansRequired, thirdHalf, audience, repeatWeekly,
      meetingNote: meetingNote.trim() || null,
    };

    setSaving(true);
    const result = await attempt(() => savePlan(input, defaults.id));
    setSaving(false);
    if (!result.ok) return setError(result.error);
    if (!('id' in result)) return setError(copy.errors.save);

    router.replace(`/planes/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-6 pb-4" noValidate>
      <h1 className="font-display text-3xl font-bold">
        {isEdit ? copy.create.editTitle : copy.create.title}
      </h1>

      <Field label={copy.create.sport}>
        {(props) => (
          <select
            {...props}
            className={inputClass}
            value={sport}
            onChange={(e) => {
              const next = e.target.value as SportKey;
              setSport(next);
              const nextBands = bandsFor(next);
              setLevelMin(nextBands[0]!.norm);
              setLevelMax(nextBands[nextBands.length - 1]!.norm);
            }}
          >
            {sportOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-display text-xl font-bold">{copy.create.when}</legend>
        <div className="flex gap-3">
          <Field label={copy.create.dateLabel}>
            {(props) => (
              <input
                {...props}
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
          </Field>
          <Field label={copy.create.timeLabel}>
            {(props) => (
              <input
                {...props}
                type="time"
                step={300}
                className={inputClass}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            )}
          </Field>
        </div>
        {/* Native date and time inputs render in the browser's own UI language,
            which the page cannot set. Echoing the choice back in Spanish removes
            the ambiguity, and confirms the Madrid time the host actually meant. */}
        {date ? (
          <p className="text-tinta-60" data-numeric>
            {(() => {
              try {
                const at = madridInstant(date, time);
                return `${formatLongDate(at)} · ${formatTime(at)}`;
              } catch {
                return copy.create.errors.past;
              }
            })()}
          </p>
        ) : null}
        <Field label={copy.create.repeatLabel} help={copy.create.repeatHelp}>
          {(props) => (
            <select
              {...props}
              className={inputClass}
              value={repeatWeekly ? 'weekly' : 'once'}
              onChange={(e) => setRepeatWeekly(e.target.value === 'weekly')}
            >
              <option value="once">{copy.create.repeatOnce}</option>
              <option value="weekly">{copy.create.repeatWeekly}</option>
            </select>
          )}
        </Field>
        <Field label={copy.create.durationLabel}>
          {(props) => (
            <select
              {...props}
              className={inputClass}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {copy.create.durationValue(d)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-display text-xl font-bold">{copy.create.where}</legend>
        <Field label={copy.create.venueLabel}>
          {(props) => (
            <select
              {...props}
              className={inputClass}
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              <option value="">—</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.distrito}
                </option>
              ))}
            </select>
          )}
        </Field>

        {pinning ? (
          <div className="flex flex-col gap-3 border-l-4 border-pista bg-linea p-3">
            <p className="text-[15px] text-tinta-60">{copy.create.venuePinHelp}</p>
            <VenueMapPicker center={center} onPick={setPinPoint} />
            <Field label={copy.create.venuePinName}>
              {(props) => (
                <input
                  {...props}
                  className={inputClass}
                  placeholder={copy.create.venuePinPlaceholder}
                  value={pinName}
                  onChange={(e) => setPinName(e.target.value)}
                  maxLength={80}
                />
              )}
            </Field>
            <Field label={copy.create.venuePinDistrito}>
              {(props) => (
                <select
                  {...props}
                  className={inputClass}
                  value={pinDistrito}
                  onChange={(e) => setPinDistrito(e.target.value)}
                >
                  {DISTRITOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <p className="text-[15px] text-tinta-60">{copy.create.venuePinUnverified}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPinning(false)}>
                {copy.common.cancel}
              </Button>
              <Button className="flex-1" onClick={addPinnedVenue} disabled={pinName.trim().length < 3}>
                {copy.create.venuePinSave}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="quiet" className="self-start px-0" onClick={() => setPinning(true)}>
            {copy.create.venuePin}
          </Button>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-display text-xl font-bold">{copy.create.level}</legend>
        <div className="flex gap-3">
          <Field label={copy.create.levelFrom}>
            {(props) => (
              <select
                {...props}
                className={inputClass}
                value={levelMin}
                onChange={(e) => setLevelMin(Number(e.target.value))}
              >
                {bands.map((b) => (
                  <option key={b.norm} value={b.norm}>
                    {b.display}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={copy.create.levelTo}>
            {(props) => (
              <select
                {...props}
                className={inputClass}
                value={levelMax}
                onChange={(e) => setLevelMax(Number(e.target.value))}
              >
                {bands.map((b) => (
                  <option key={b.norm} value={b.norm}>
                    {b.display}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {/* Exactly what the card will say, so there are no surprises. */}
        <p className="text-tinta-60" data-numeric>
          {formatLevelRange(sport, Math.min(levelMin, levelMax), Math.max(levelMin, levelMax))}
        </p>
      </fieldset>

      <Field label={copy.create.capacity} help={copy.create.capacityHelp}>
        {(props) => (
          <input
            {...props}
            type="number"
            inputMode="numeric"
            min={2}
            max={40}
            className={inputClass}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        )}
      </Field>

      <Field label={copy.create.gateLabel} help={copy.create.gateHelp}>
        {(props) => (
          <select
            {...props}
            className={inputClass}
            value={minPlansRequired}
            onChange={(e) => setMinPlansRequired(Number(e.target.value))}
          >
            <option value={0}>{copy.create.gateOptions.none}</option>
            <option value={1}>{copy.create.gateOptions.one}</option>
            <option value={2}>{copy.create.gateOptions.two}</option>
          </select>
        )}
      </Field>
      {minPlansRequired === 0 && reservedPlazas(capacity, 0) > 0 ? (
        <p className="-mt-3 text-[15px] text-tinta-60">{copy.plan.reservedPlaza}</p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="font-display text-xl font-bold">{copy.create.thirdHalfLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {THIRD_HALVES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={thirdHalf === value}
              onClick={() => setThirdHalf(value)}
              className={`tap rounded-[4px] border px-3 py-2 ${
                thirdHalf === value
                  ? 'border-pista bg-pista text-linea'
                  : 'border-borde bg-linea text-tinta'
              }`}
            >
              {copy.plan.thirdHalf[value]}
            </button>
          ))}
        </div>
        {thirdHalf !== 'ninguno' && cafes.length > 0 ? (
          <Field label={copy.create.thirdHalfVenueLabel}>
            {(props) => (
              <select
                {...props}
                className={inputClass}
                value={thirdHalfVenueId}
                onChange={(e) => setThirdHalfVenueId(e.target.value)}
              >
                <option value="">—</option>
                {cafes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.distrito}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}
      </fieldset>

      {canCreateWomenOnly ? (
        <Field
          label={copy.create.audienceLabel}
          help={audience === 'solo_mujeres' ? copy.create.audienceWomenHelp : undefined}
        >
          {(props) => (
            <select
              {...props}
              className={inputClass}
              value={audience}
              onChange={(e) => setAudience(e.target.value as 'todos' | 'solo_mujeres')}
            >
              <option value="todos">{copy.create.audienceAll}</option>
              <option value="solo_mujeres">{copy.create.audienceWomen}</option>
            </select>
          )}
        </Field>
      ) : null}

      <Field label={copy.create.noteLabel}>
        {(props) => (
          <textarea
            {...props}
            className={`${inputClass} min-h-24`}
            placeholder={copy.create.notePlaceholder}
            value={meetingNote}
            onChange={(e) => setMeetingNote(e.target.value)}
            maxLength={200}
          />
        )}
      </Field>

      {error ? (
        <p role="alert" className="text-aviso">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 bg-cal pb-2 pt-3">
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? copy.create.saving : isEdit ? copy.create.save : copy.create.submit}
        </Button>
      </div>
    </form>
  );
}
