import type { Metadata } from 'next';
import { DeckFilterBar } from '@/features/deck/deck-filters';
import { DEFAULT_FILTERS } from '@/features/deck/filters';
import { PlanForm } from '@/features/plans/plan-form';
import { Bib } from '@/components/ui/bib';
import { Button } from '@/components/ui/button';
import { PlanCard } from '@/components/plan-card';
import type { PlanCardData } from '@/features/plans/queries';

const plan: PlanCardData = {
  id: '1', sport: 'running', startsAt: '2026-09-12T09:30:00+02:00', durationMin: 70,
  distrito: 'Retiro', levelMin: 4, levelMax: 6, levelDisplay: '8 km · 5:30–6:00 min/km',
  capacity: 6, joinedCount: 4, thirdHalf: 'cafe', thirdHalfVenueName: 'Café en Malasaña',
  audience: 'todos', minPlansRequired: 0, meetingNote: null, isSeed: true,
  status: 'open', cancelledReason: null, venueId: 'v', thirdHalfVenueId: null,
  venue: { id: 'v', name: 'Parque del Retiro — Puerta de Alcalá', distrito: 'Retiro', lat: 40.42, lng: -3.688, verified: false },
  host: { id: 'h', displayName: 'Marta', dorsalNumber: 1042, photoUrl: null },
};
const plan2: PlanCardData = {
  ...plan, id: '2', sport: 'padel', startsAt: '2026-09-11T20:30:00+02:00',
  distrito: 'Salamanca', levelDisplay: 'Nivel 3,5–4,0', capacity: 4, joinedCount: 3,
  thirdHalf: 'cana', thirdHalfVenueName: null, audience: 'solo_mujeres',
  venue: { id: 'v2', name: 'Pistas de pádel — Salamanca', distrito: 'Salamanca', lat: 40.4, lng: -3.6, verified: true },
  host: { id: 'h2', displayName: 'Lucía', dorsalNumber: 1077, photoUrl: null },
};

export const metadata: Metadata = { title: 'Kit', robots: { index: false, follow: false } };

/**
 * The component reference. Fixed sample data, no database, so the design pass
 * can be screenshotted and criticised at any point without a session.
 */
export default function Kit() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <PlanCard plan={plan} />
      <PlanCard plan={plan2} />
      <div className="flex items-center gap-3">
        <Bib number={1042} size="lg" />
        <Bib number={7} />
        <Bib number={318} size="sm" />
      </div>
      <DeckFilterBar
        filters={{ ...DEFAULT_FILTERS, sport: 'running' }}
        sports={['running', 'padel', 'escalada']}
        canSeeWomenOnly
      />
      <PlanForm
        defaults={{
          sport: 'running', durationMin: 60, venueId: null, thirdHalfVenueId: null,
          levelMin: 4, levelMax: 7, capacity: 8, thirdHalf: 'cafe',
          audience: 'todos', meetingNote: null,
        }}
        venues={[
          { id: '11111111-1111-5111-8111-111111111111', name: 'Parque del Retiro — Puerta de Alcalá', kind: 'parque', distrito: 'Retiro', lat: 40.42, lng: -3.688, verified: false },
          { id: '22222222-2222-5222-8222-222222222222', name: 'Café en Malasaña', kind: 'cafe', distrito: 'Centro', lat: 40.426, lng: -3.703, verified: false },
        ]}
        mySports={['running', 'padel']}
        myDistrito="Chamberí"
        canCreateWomenOnly
        center={{ lat: 40.4168, lng: -3.7038 }}
        initialDate="2026-09-12"
      />
      <div className="flex flex-wrap gap-2">
        <Button>Me apunto</Button>
        <Button variant="secondary">Paso</Button>
        <Button variant="quiet">Ver en lista</Button>
        <Button variant="destructive">Salirme del plan</Button>
      </div>
    </div>
  );
}
