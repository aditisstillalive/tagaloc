"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Suggestion {
  label: string;
  lat: string;
  lon: string;
}

interface Props {
  token: string;
  onSelect: (lat: number, lng: number, name: string) => void;
  initialName?: string;
}

// Indonesia center
const CENTER: [number, number] = [118, -2.5];
const ZOOM = 4.5;

export default function LocationPicker({ token, onSelect, initialName }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [query, setQuery] = useState(initialName ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState(initialName ?? "");
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: CENTER,
      zoom: ZOOM,
    });

    m.addControl(new mapboxgl.NavigationControl(), "top-right");

    m.on("load", () => setMapReady(true));

    // Click on map → place marker
    m.on("click", (e) => {
      placeMarker(e.lngLat.lat, e.lngLat.lng);
      reverseGeocode(e.lngLat.lat, e.lngLat.lng);
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, [token]);

  // Init marker
  useEffect(() => {
    if (!map.current || !mapReady || marker.current) return;

    const el = document.createElement("div");
    el.innerHTML = `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="#dc2626"/>
      <circle cx="18" cy="18" r="4" fill="white"/>
    </svg>`;
    el.style.cursor = "pointer";

    const m = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat(CENTER)
      .addTo(map.current);

    m.on("dragend", () => {
      const pos = m.getLngLat();
      reverseGeocode(pos.lat, pos.lng);
    });

    marker.current = m;
  }, [mapReady]);

  function placeMarker(lat: number, lng: number) {
    if (!marker.current) return;
    marker.current.setLngLat([lng, lat]);
  }

  async function reverseGeocode(lat: number, lng: number) {
    setSelectedCoords({ lat, lng });
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = (await res.json()) as { name: string };
      setSelectedName(data.name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch {
      setSelectedName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  }

  // Search autocomplete
  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(val.trim())}`);
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 350);
  }

  function selectSuggestion(s: Suggestion) {
    setQuery(s.label);
    setSelectedName(s.label);
    setOpen(false);
    setSuggestions([]);

    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setSelectedCoords({ lat, lng });

    placeMarker(lat, lng);
    map.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
  }

  function handleConfirm() {
    if (!selectedCoords) return;
    onSelect(selectedCoords.lat, selectedCoords.lng, selectedName);
    setQuery(selectedName);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search for a place in Indonesia..."
          autoComplete="off"
          className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-zinc-400"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-b-0"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapContainer}
        className="w-full h-72 rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden"
      />

      {/* Selected info */}
      {selectedCoords && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400 truncate">
            {selectedName}
          </span>
          <span className="text-zinc-400 dark:text-zinc-500 shrink-0 font-mono text-xs">
            {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
          </span>
        </div>
      )}

      {/* Confirm */}
      <button
        type="button"
        disabled={!selectedCoords}
        onClick={handleConfirm}
        className="py-2.5 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Confirm Location
      </button>
    </div>
  );
}
