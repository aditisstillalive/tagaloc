"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Props {
  token: string;
  onSelect: (lat: number, lng: number, name: string) => void;
  initialName?: string;
}

const CENTER: [number, number] = [118, -2.5];
const ZOOM = 4.5;

export default function LocationPicker({ token, onSelect, initialName }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [query, setQuery] = useState(initialName ?? "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState(initialName ?? "");
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 2) return;

    setSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        suggestions: Array<{ label: string; lat: string; lon: string }>;
      };

      if (data.suggestions.length === 0) {
        setSearchError(`No results found for "${q}"`);
        setSearching(false);
        return;
      }

      const top = data.suggestions[0];
      const lat = parseFloat(top.lat);
      const lng = parseFloat(top.lon);

      setSelectedName(top.label);
      setSelectedCoords({ lat, lng });
      placeMarker(lat, lng);
      map.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
      setHasSearched(true);
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  function handleConfirm() {
    if (!selectedCoords) return;
    onSelect(selectedCoords.lat, selectedCoords.lng, selectedName);
    setQuery(selectedName);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a place in Indonesia..."
          autoComplete="off"
          className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-zinc-400"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || query.trim().length < 2}
          className="px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {searching ? "..." : "Search"}
        </button>
      </div>

      {searchError && (
        <p className="text-red-600 dark:text-red-400 text-sm">{searchError}</p>
      )}

      {/* Map */}
      <div
        ref={mapContainer}
        className="w-full h-72 rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden"
      />

      {/* Help text before first search */}
      {!hasSearched && !selectedCoords && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          Search for a place, then click the map or drag the marker to fine-tune.
        </p>
      )}

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
