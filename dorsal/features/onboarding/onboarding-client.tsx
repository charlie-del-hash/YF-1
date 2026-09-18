'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { bandsFor, getSport } from '@/lib/levels';
import { DISTRITOS, LAUNCH_SPORTS, SPORTS, type SportKey } from '@/lib/sports';
import { PhotoPicker } from '@/features/profile/photo-picker';
import { completeOnboarding } from './actions';
import { maxBirthYear } from './schema';

type Gender = 'mujer' | 'hombre' | 'no_binario' | 'prefiero_no_decirlo';
const TOTAL_STEPS = 4;

/**
 * Four steps, under sixty seconds. The order is deliberate: sports and levels
 * first, because they are the questions someone is happy to answer, and the
 * personal ones (name, year, photo) last, when they have already invested.
 */
export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState<SportKey[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [distrito, setDistrito] = useState('');
  const [travelKm, setTravelKm] = useState(5);
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Launch sports first (01-PRD §Cold start), then everything else.
  const ordered = [
    ...SPORTS.filter((s) => LAUNCH_SPORTS.includes(s.key)),
    ...SPORTS.filter((s) => !LAUNCH_SPORTS.includes(s.key)),
  ];

  function toggleSport(key: SportKey) {
    setSports((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  function next() {
    setError(undefined);
    if (step === 0 && sports.length === 0) return setError(copy.onboarding.sports.error);
    if (step === 1 && sports.some((s) => levels[s] === undefined)) {
      return setError(copy.onboarding.levels.error);
    }
    if (step === 2 && !distrito) return setError(copy.onboarding.zone.error);
    setStep((s) => s + 1);
  }

  async function submit() {
    setError(undefined);
    const trimmed = displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      return setError(copy.onboarding.identity.errors.name);
    }
    const year = Number(birthYear);
    if (!Number.isInteger(year) || year < 1900) {
      return setError(copy.onboarding.identity.errors.birthYear);
    }
    if (year > maxBirthYear()) return setError(copy.onboarding.identity.errors.under18);

    setSaving(true);
    const result = await attempt(() =>
      completeOnboarding({
        displayName: trimmed,
        birthYear: year,
        distrito,
        travelKm,
        gender: gender === '' ? null : gender,
        photoUrl: photoPath,
        sports: sports.map((s) => ({ sport: s, levelNorm: levels[s]! })),
      }),
    );
    setSaving(false);

    if (!result.ok) return setError(result.error);
    router.replace('/planes');
    router.refresh();
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <p className="font-display text-sm font-semibold text-tinta-60" data-numeric>
        {copy.onboarding.stepOf(step + 1, TOTAL_STEPS)}
      </p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-[2px] ${i <= step ? 'bg-pista' : 'bg-borde'}`}
          />
        ))}
      </div>

      <div className="mt-6 flex-1">
        {step === 0 ? (
          <section>
            <h1 className="font-display text-3xl font-bold">{copy.onboarding.sports.title}</h1>
            <p className="mt-1 text-tinta-60">{copy.onboarding.sports.help}</p>
            <ul className="mt-5 grid grid-cols-2 gap-2">
              {ordered.map((sport) => {
                const on = sports.includes(sport.key);
                return (
                  <li key={sport.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSport(sport.key)}
                      className={`tap w-full rounded-[4px] border px-3 py-3 text-left ${
                        on ? 'border-pista bg-pista text-linea' : 'border-borde bg-linea text-tinta'
                      }`}
                    >
                      {sport.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="flex flex-col gap-7">
            {sports.map((key) => {
              const sport = getSport(key);
              return (
                <div key={key}>
                  <h2 className="font-display text-2xl font-bold">
                    {key === 'running'
                      ? copy.onboarding.levels.titleRunning
                      : copy.onboarding.levels.title(sport.label)}
                  </h2>
                  <p className="mt-1 text-tinta-60">{copy.onboarding.levels.help}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {bandsFor(key).map((band) => {
                      const on = levels[key] === band.norm;
                      return (
                        <li key={band.norm}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setLevels((prev) => ({ ...prev, [key]: band.norm }))}
                            className={`tap w-full rounded-[4px] border px-3 py-3 text-left ${
                              on ? 'border-pista bg-pista text-linea' : 'border-borde bg-linea'
                            }`}
                          >
                            <span className="font-medium" data-numeric>
                              {band.display}
                            </span>
                            {band.note ? (
                              <span
                                className={`block text-[15px] ${on ? 'text-linea/80' : 'text-tinta-60'}`}
                              >
                                {band.note}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-col gap-5">
            <h1 className="font-display text-3xl font-bold">{copy.onboarding.zone.title}</h1>
            <p className="-mt-4 text-tinta-60">{copy.onboarding.zone.help}</p>
            <Field label={copy.onboarding.zone.distritoLabel}>
              {(props) => (
                <select
                  {...props}
                  className={inputClass}
                  value={distrito}
                  onChange={(e) => setDistrito(e.target.value)}
                >
                  <option value="">—</option>
                  {DISTRITOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={copy.onboarding.zone.travelLabel}>
              {(props) => (
                <div className="flex items-center gap-3">
                  <input
                    {...props}
                    type="range"
                    min={1}
                    max={30}
                    value={travelKm}
                    onChange={(e) => setTravelKm(Number(e.target.value))}
                    className="h-11 w-full accent-[var(--color-pista)]"
                  />
                  <span className="font-display text-xl font-bold" data-numeric>
                    {copy.onboarding.zone.travelValue(travelKm)}
                  </span>
                </div>
              )}
            </Field>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-col gap-5">
            <h1 className="font-display text-3xl font-bold">{copy.onboarding.identity.title}</h1>
            <p className="-mt-4 text-tinta-60">{copy.onboarding.identity.help}</p>
            <Field label={copy.onboarding.identity.nameLabel}>
              {(props) => (
                <input
                  {...props}
                  className={inputClass}
                  autoComplete="given-name"
                  placeholder={copy.onboarding.identity.namePlaceholder}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                />
              )}
            </Field>
            <Field label={copy.onboarding.identity.birthYearLabel}>
              {(props) => (
                <input
                  {...props}
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={maxBirthYear()}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                />
              )}
            </Field>
            <Field
              label={copy.onboarding.identity.genderLabel}
              help={copy.onboarding.identity.genderHelp}
            >
              {(props) => (
                <select
                  {...props}
                  className={inputClass}
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | '')}
                >
                  <option value="">—</option>
                  {(Object.keys(copy.onboarding.identity.genderOptions) as Gender[]).map((key) => (
                    <option key={key} value={key}>
                      {copy.onboarding.identity.genderOptions[key]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex flex-col gap-2">
              <PhotoPicker path={photoPath} onChange={setPhotoPath} onError={setError} />
              <p className="text-[15px] text-tinta-60">
                {photoPath
                  ? copy.onboarding.identity.photoPrivate
                  : copy.onboarding.identity.photoSkip}
              </p>
            </div>
          </section>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-aviso">
          {error}
        </p>
      ) : null}

      {/* Primary action in the bottom third: this is used one-handed. */}
      <div className="sticky bottom-0 mt-6 flex gap-3 bg-cal pb-2 pt-3">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            {copy.onboarding.back}
          </Button>
        ) : null}
        {step < TOTAL_STEPS - 1 ? (
          <Button className="flex-1" onClick={next}>
            {copy.onboarding.next}
          </Button>
        ) : (
          <Button className="flex-1" onClick={submit} disabled={saving}>
            {saving ? copy.onboarding.saving : copy.onboarding.finish}
          </Button>
        )}
      </div>
    </main>
  );
}
