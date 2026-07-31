"use client";

/* eslint-disable @next/next/no-img-element -- blob URLs from user uploads, next/image cannot handle dynamic blobs */
import { useState, useRef, useEffect } from "react";

interface Suggestion {
  label: string;
  lat: string;
  lon: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(location.trim(), 350);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    let cancelled = false;

    if (debouncedQuery.length < 2) {
      return () => { cancelled = true; };
    }

    fetch(`/api/geocode?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSuggestions((data.suggestions as Suggestion[]) ?? []);
          setOpen(true);
          setHighlightIdx(-1);
        }
      })
      .catch(() => {
        // Silently ignore — user can still type and submit
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectSuggestion(s: Suggestion) {
    setLocation(s.label);
    setOpen(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        if (highlightIdx >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[highlightIdx]);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlightIdx(-1);
        break;
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    setWatermarkedUrl(null);
    setError(null);

    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }

    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image || !location.trim()) return;

    setLoading(true);
    setError(null);
    setOpen(false);

    if (watermarkedUrl) {
      URL.revokeObjectURL(watermarkedUrl);
      setWatermarkedUrl(null);
    }

    try {
      const formData = new FormData();
      formData.append("image", image);
      formData.append("location", location.trim());

      const res = await fetch("/api/watermark", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        setError(body.error ?? "Something went wrong.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setWatermarkedUrl(url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setImage(null);
    setPreview(null);
    setLocation("");
    setError(null);
    setSuggestions([]);
    setOpen(false);
    if (watermarkedUrl) {
      URL.revokeObjectURL(watermarkedUrl);
      setWatermarkedUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <main className="w-full max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center mb-8 text-zinc-900 dark:text-zinc-50">
          tagaloc
        </h1>

        {watermarkedUrl ? (
          <div className="flex flex-col gap-4">
            <img
              src={watermarkedUrl}
              alt="Watermarked"
              className="w-full rounded-lg shadow-lg"
            />
            <div className="flex gap-3">
              <a
                href={watermarkedUrl}
                download="tagaloc.png"
                className="flex-1 text-center py-3 px-4 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Download
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="py-3 px-4 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                New Image
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors dark:border-zinc-700 dark:hover:border-zinc-400">
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="h-full w-full object-contain rounded-lg p-1"
                />
              ) : (
                <div className="text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-lg font-medium">Click to upload image</p>
                  <p className="text-sm mt-1">JPG, PNG, WebP</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>

            {/* Location input with autocomplete */}
            <div ref={wrapperRef} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setOpen(true);
                }}
                placeholder="Location name (e.g. Paris, France)"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-zinc-400"
              />
              {open && suggestions.length > 0 && debouncedQuery.length >= 2 && (
                <ul className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => selectSuggestion(s)}
                        onMouseEnter={() => setHighlightIdx(i)}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-zinc-100 dark:border-zinc-700 last:border-b-0 ${
                          i === highlightIdx
                            ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750"
                        }`}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={!image || !location.trim() || loading}
              className="py-3 px-4 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Processing..." : "Watermark"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
