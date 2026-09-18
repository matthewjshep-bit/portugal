import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { REGIONS, CATEGORIES } from '../data/trip';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function markerIcon(place, isActive) {
  const color = REGIONS[place.region]?.color || '#64748b';
  const glyph = CATEGORIES[place.cat]?.pin || '•';
  return L.divIcon({
    className: 'trip-marker-wrap',
    html: `<span class="trip-marker${isActive ? ' is-active' : ''}" style="--pin:${color}">
             <span class="trip-marker__glyph">${glyph}</span>
           </span>`,
    iconSize: isActive ? [38, 38] : [28, 28],
    iconAnchor: isActive ? [19, 19] : [14, 14],
  });
}

function mapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name} ${place.area || ''} Portugal`,
  )}`;
}

const ROUTE = [
  [41.1470, -8.6200], // Porto
  [41.1836, -7.7141], // Douro
  [41.1470, -8.6200], // back to Porto
  [38.3565, -8.7635], // Comporta
  [38.7120, -9.1420], // Lisbon
  [38.7930, -9.3930], // Sintra
  [38.7120, -9.1420], // Lisbon
];

export default function TripMap({ places, activeId, focusId, onSelect, showRoute }) {
  const [tilesDown, setTilesDown] = useState(false);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const routeRef = useRef(null);
  const markersRef = useRef({});
  const onSelectRef = useRef(onSelect);

  onSelectRef.current = onSelect;

  /* init once */
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([39.5, -8.6], 7);

    const tiles = L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 });
    let tileErrors = 0;
    tiles.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors > 3) setTilesDown(true);
    });
    tiles.on('tileload', () => setTilesDown(false));
    tiles.addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.on('click', () => onSelectRef.current?.(null));

    mapRef.current = map;
    routeRef.current = L.polyline(ROUTE, {
      color: '#e9c08a',
      weight: 2,
      opacity: 0.55,
      dashArray: '7 9',
      interactive: false,
    });
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      routeRef.current = null;
      markersRef.current = {};
    };
  }, []);

  /* redraw markers + fit to the visible set */
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersRef.current = {};

    places.forEach((place) => {
      const marker = L.marker(place.coords, {
        icon: markerIcon(place, place.id === activeId),
        title: place.name,
        riseOnHover: true,
      });
      marker.bindPopup(
        `<div class="trip-popup">
           <span class="trip-popup__cat" style="--pin:${REGIONS[place.region]?.color}">${
             CATEGORIES[place.cat]?.label || ''
           }${place.tag ? ` · ${place.tag}` : ''}</span>
           <strong>${place.name}</strong>
           <span class="trip-popup__area">${place.area || ''}</span>
           <p>${place.desc || ''}</p>
           <a href="${mapsUrl(place)}" target="_blank" rel="noreferrer">Directions ↗</a>
         </div>`,
        { className: 'trip-popup-shell', maxWidth: 260 },
      );
      marker.on('click', () => onSelectRef.current?.(place.id));
      marker.addTo(layer);
      markersRef.current[place.id] = marker;
    });

    if (!places.length) return;
    if (places.length === 1) {
      map.flyTo(places[0].coords, 14, { duration: 0.8 });
      return;
    }
    const bounds = L.latLngBounds(places.map((p) => p.coords));
    map.flyToBounds(bounds, { padding: [56, 56], maxZoom: 15, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  /* the dashed trip route, only on the whole-trip view */
  useEffect(() => {
    const map = mapRef.current;
    const route = routeRef.current;
    if (!map || !route) return;
    if (showRoute) route.addTo(map);
    else route.remove();
  }, [showRoute]);

  /* restyle active marker without refitting */
  useEffect(() => {
    places.forEach((place) => {
      const marker = markersRef.current[place.id];
      if (marker) marker.setIcon(markerIcon(place, place.id === activeId));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* fly to a specific place when a card asks for it */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const place = places.find((p) => p.id === focusId);
    const marker = markersRef.current[focusId];
    if (!place) return;
    map.flyTo(place.coords, Math.max(map.getZoom(), 14), { duration: 0.7 });
    if (marker) setTimeout(() => marker.openPopup(), 720);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return (
    <div className="trip-mapwrap">
      <div className="trip-map" ref={containerRef} aria-label="Trip map" />
      {tilesDown && (
        <p className="trip-map__offline">
          Map tiles are blocked on this network — the pins below are still positioned correctly, and
          every place links out to Google Maps.
        </p>
      )}
    </div>
  );
}
