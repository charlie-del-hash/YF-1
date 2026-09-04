'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { copy } from '@/lib/copy/es-ES';

/**
 * Pinning a meeting point on the map.
 *
 * Deliberately not a search box: a search box invites "my flat", and 01-PRD is
 * explicit that meeting points are public places. A host drops a pin, names it
 * in their own words and picks the distrito, and it is stored unverified and
 * labelled everywhere until someone confirms it.
 *
 * With no tile provider configured there is no honest way to pin a coordinate,
 * so the control says so and the curated list is the only route.
 */
export function VenueMapPicker({
  center,
  onPick,
}: {
  center: { lat: number; lng: number };
  onPick: (point: { lat: number; lng: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

  useEffect(() => {
    if (!styleUrl || !container.current) return;
    let map: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !container.current) return;

        const instance = new maplibre.Map({
          container: container.current,
          style: styleUrl,
          center: [center.lng, center.lat],
          zoom: 13,
        });
        const marker = new maplibre.Marker({ color: '#0E5C8C', draggable: true })
          .setLngLat([center.lng, center.lat])
          .addTo(instance);

        const report = () => {
          const { lat, lng } = marker.getLngLat();
          onPick({ lat, lng });
        };
        marker.on('dragend', report);
        instance.on('click', (event) => {
          marker.setLngLat(event.lngLat);
          report();
        });

        map = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // The callback is stable in practice; re-running would recreate the map on
    // every keystroke in the surrounding form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, center.lat, center.lng]);

  if (!styleUrl || failed) {
    return (
      <p className="rounded-[4px] border border-borde bg-linea p-3 text-tinta-60">
        {copy.plan.mapUnavailable}
      </p>
    );
  }

  return (
    <div
      ref={container}
      className="h-64 w-full overflow-hidden rounded-[4px] border border-borde"
    />
  );
}
