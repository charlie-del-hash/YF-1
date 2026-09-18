import { z } from 'zod';
import { DISTRITOS, SPORT_KEYS } from '@/lib/sports';

/** 18+ is a product decision, not a data-protection minimum. 05-RGPD §7. */
export const MIN_AGE = 18;
export const maxBirthYear = (now: Date = new Date()) => now.getFullYear() - MIN_AGE;

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  birthYear: z.number().int().min(1900).max(maxBirthYear()),
  distrito: z.string().refine((v) => DISTRITOS.includes(v)),
  travelKm: z.number().int().min(1).max(30),
  // Optional, and only ever used to gate solo_mujeres plans. 05-RGPD §3.
  gender: z.enum(['mujer', 'hombre', 'no_binario', 'prefiero_no_decirlo']).nullable(),
  photoUrl: z.string().url().nullable(),
  sports: z
    .array(
      z.object({
        sport: z.enum(SPORT_KEYS),
        levelNorm: z.number().int().min(1).max(10),
      }),
    )
    .min(1),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
