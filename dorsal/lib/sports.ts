/**
 * The sport catalogue and its level scales.
 *
 * This is product configuration, not data, so it lives in TypeScript rather
 * than being imported from supabase/seed-madrid.json — importing that file
 * would drag the demo profiles and plans into the client bundle. The two are
 * kept honest by lib/levels.test.ts, which fails if they drift.
 */

export const SPORT_KEYS = [
  'running', 'padel', 'tenis', 'futbol', 'baloncesto', 'ciclismo',
  'escalada', 'natacion', 'hyrox', 'senderismo', 'yoga', 'fuerza',
] as const;
export type SportKey = (typeof SPORT_KEYS)[number];

export const LEVEL_SCALES = [
  'pace_min_km', 'padel_1_7', 'football_tier', 'speed_kmh', 'climb_grade', 'generic_3',
] as const;
export type LevelScale = (typeof LEVEL_SCALES)[number];

/** A rung on a sport's own ladder. `norm` is the 1–10 value stored and filtered on. */
export interface LevelBand {
  readonly norm: number;
  /** Written the way the sport writes it: "5:30–6:00 min/km", "Nivel 3,5–4,0". */
  readonly display: string;
  readonly note?: string;
}

export interface ExtraField {
  readonly key: string;
  readonly label: string;
  readonly unit?: string;
  readonly options?: readonly string[];
}

export interface Sport {
  readonly key: SportKey;
  readonly label: string;
  readonly scale: LevelScale;
  readonly bands: readonly LevelBand[];
  readonly extraFields?: readonly ExtraField[];
}

/** Used by every sport whose scale is `generic_3`. */
export const GENERIC_BANDS: readonly LevelBand[] = [
  { norm: 3, display: 'Principiante' },
  { norm: 6, display: 'Intermedio' },
  { norm: 9, display: 'Avanzado' },
];

export const SPORTS: readonly Sport[] = [
  {
    key: 'running',
    label: 'Running',
    scale: 'pace_min_km',
    bands: [
      { norm: 2, display: 'Más de 7:00 min/km', note: 'Empezando o volviendo' },
      { norm: 4, display: '6:00–7:00 min/km' },
      { norm: 5, display: '5:30–6:00 min/km' },
      { norm: 7, display: '5:00–5:30 min/km' },
      { norm: 8, display: '4:30–5:00 min/km' },
      { norm: 10, display: 'Menos de 4:30 min/km' },
    ],
    extraFields: [{ key: 'distance_km', label: 'Distancia', unit: 'km' }],
  },
  {
    key: 'padel',
    label: 'Pádel',
    scale: 'padel_1_7',
    bands: [
      { norm: 2, display: '1,0–2,0', note: 'Primeras veces' },
      { norm: 4, display: '2,5–3,0' },
      { norm: 6, display: '3,5–4,0' },
      { norm: 8, display: '4,5–5,0' },
      { norm: 10, display: '5,5–7,0', note: 'Competición' },
    ],
  },
  {
    key: 'tenis',
    label: 'Tenis',
    scale: 'padel_1_7',
    bands: [
      { norm: 3, display: '1,0–2,5' },
      { norm: 6, display: '3,0–4,5' },
      { norm: 9, display: '5,0–7,0' },
    ],
  },
  {
    key: 'futbol',
    label: 'Fútbol 7 / 11',
    scale: 'football_tier',
    bands: [
      { norm: 3, display: 'Recreativo' },
      { norm: 5, display: 'Veteranos' },
      { norm: 6, display: 'He jugado federado' },
    ],
  },
  {
    key: 'baloncesto',
    label: 'Baloncesto',
    scale: 'football_tier',
    bands: [
      { norm: 3, display: 'Recreativo' },
      { norm: 6, display: 'He jugado federado' },
    ],
  },
  {
    key: 'ciclismo',
    label: 'Ciclismo',
    scale: 'speed_kmh',
    bands: [
      { norm: 3, display: 'Menos de 22 km/h' },
      { norm: 5, display: '22–26 km/h' },
      { norm: 7, display: '26–30 km/h' },
      { norm: 9, display: 'Más de 30 km/h' },
    ],
    extraFields: [
      { key: 'distance_km', label: 'Distancia', unit: 'km' },
      { key: 'surface', label: 'Tipo', options: ['carretera', 'gravel', 'MTB'] },
    ],
  },
  {
    key: 'escalada',
    label: 'Escalada / Boulder',
    scale: 'climb_grade',
    bands: [
      { norm: 2, display: '4–5 / V0–V1', note: 'Primeras sesiones' },
      { norm: 5, display: '6a–6c / V2–V4' },
      { norm: 8, display: '7a–7c / V5–V8' },
      { norm: 10, display: '8a+ / V9+' },
    ],
  },
  { key: 'natacion',   label: 'Natación',          scale: 'generic_3', bands: GENERIC_BANDS },
  { key: 'hyrox',      label: 'Hyrox / funcional', scale: 'generic_3', bands: GENERIC_BANDS },
  { key: 'senderismo', label: 'Senderismo',        scale: 'generic_3', bands: GENERIC_BANDS },
  { key: 'yoga',       label: 'Yoga / pilates',    scale: 'generic_3', bands: GENERIC_BANDS },
  { key: 'fuerza',     label: 'Gimnasio / fuerza', scale: 'generic_3', bands: GENERIC_BANDS },
];

/** 01-PRD §Cold start: promoted at launch. Everything else is discoverable. */
export const LAUNCH_SPORTS: readonly SportKey[] = ['running', 'padel', 'futbol', 'escalada'];
export const LAUNCH_DISTRITOS: readonly string[] = ['Chamberí', 'Centro', 'Salamanca'];

export const DISTRITOS: readonly string[] = [
  'Centro', 'Arganzuela', 'Retiro', 'Salamanca', 'Chamartín', 'Tetuán',
  'Chamberí', 'Fuencarral-El Pardo', 'Moncloa-Aravaca', 'Latina',
  'Carabanchel', 'Usera', 'Puente de Vallecas', 'Moratalaz',
  'Ciudad Lineal', 'Hortaleza', 'Villaverde', 'Villa de Vallecas',
  'Vicálvaro', 'San Blas-Canillejas', 'Barajas',
];
