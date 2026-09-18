'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { copy } from '@/lib/copy/es-ES';

/**
 * The meeting point.
 *
 * Tiles come from whatever provider NEXT_PUBLIC_MAP_STYLE_URL points at. They
 * are deliberately not OSM's own tile servers: the OSMF usage policy says in
 * as many words that its tiles are not free for applications and that access
 * will be withdrawn without notice, so shipping against them is an outage with
 * a delay on it. MapTiler, Stadia, Jawg and Protomaps all serve MapLibre styles
 * from the EU with a key.
 *
 * With no key configured the component degrades to the address and an outbound
 * directions link rather than an empty grey box — which is also what a user on
 * a bad connection gets.
 */
export function VenueMap({
  name,
  lat,
  lng,
  verified,
}: {
  name: string;
  lat: number;
  lng: number;
  verified: boolean;
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
        // The library itself is ~200 kB, so it is only fetched once a plan
        // detail is actually opened — never on the deck.
        const maplibre = await import('maplibre-gl');
        if (cancelled || !container.current) return;

        const instance = new maplibre.Map({
          container: container.current,
          style: styleUrl,
          center: [lng, lat],
          zoom: 15,
          attributionControl: { compact: true },
        });
        new maplibre.Marker({ color: '#0E5C8C' }).setLngLat([lng, lat]).addTo(instance);
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [styleUrl, lat, lng]);

  const directions = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return (
    <div>
      {styleUrl && !failed ? (
        <div
          ref={container}
          role="img"
          aria-label={name}
          className="h-56 w-full overflow-hidden rounded-[4px] border border-borde"
        />
      ) : (
        <p className="rounded-[4px] border border-borde bg-linea p-3 text-tinta-60">
          {copy.plan.mapUnavailable}
        </p>
      )}

      <p className="mt-2 font-medium">{name}</p>
      {!verified ? (
        <p className="mt-1 text-[15px] text-aviso">{copy.plan.unverifiedVenue}</p>
      ) : null}
      <a
        href={directions}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 inline-block text-pista underline underline-offset-4"
      >
        {copy.plan.openInMaps}
      </a>
    </div>
  );
}
