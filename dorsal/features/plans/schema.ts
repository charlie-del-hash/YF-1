import { z } from 'zod';
import { DISTRITOS, SPORT_KEYS } from '@/lib/sports';

export const THIRD_HALVES = ['cafe', 'cana', 'desayuno', 'comida', 'ninguno'] as const;
export const AUDIENCES = ['todos', 'solo_mujeres'] as const;

/** Durations a host picks from, rather than a free number field. */
export const DURATIONS = [45, 60, 75, 90, 120, 150, 180, 240] as const;

export const planFormSchema = z.object({
  sport: z.enum(SPORT_KEYS),
  /** Wall-clock, as typed in Madrid. lib/time.ts turns it into an instant. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(15).max(600),
  venueId: z.string().uuid(),
  thirdHalfVenueId: z.string().uuid().nullable(),
  levelMin: z.number().int().min(1).max(10),
  levelMax: z.number().int().min(1).max(10),
  capacity: z.number().int().min(2).max(40),
  thirdHalf: z.enum(THIRD_HALVES),
  audience: z.enum(AUDIENCES),
  meetingNote: z.string().trim().max(200).nullable(),
});

export type PlanFormInput = z.infer<typeof planFormSchema>;

/** A host-pinned meeting point. Public places only — 01-PRD §Trust and safety. */
export const venuePinSchema = z.object({
  name: z.string().trim().min(3).max(80),
  distrito: z.string().refine((v) => DISTRITOS.includes(v)),
  lat: z.number().min(35).max(45),
  lng: z.number().min(-10).max(5),
});

export type VenuePinInput = z.infer<typeof venuePinSchema>;
