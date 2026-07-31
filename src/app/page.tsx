"use client";

/* eslint-disable @next/next/no-img-element -- blob URLs, next/image cannot handle dynamic blobs */
import { useState, useRef } from "react";
import LocationPicker from "./components/LocationPicker";

function formatCoordinate(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

async function applyWatermark(
  imageFile: File,
  lat: number,
  lng: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Calculate watermark size
      const fontSize = Math.max(18, Math.round(Math.min(img.width, img.height) * 0.035));
      const padding = Math.round(fontSize * 1.2);
      const text = `${formatCoordinate(lat, 6)}, ${formatCoordinate(lng, 6)}`;

      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";

      // Stroke outline
      ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(text, img.width - padding, img.height - padding);

      // Fill text
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(text, img.width - padding, img.height - padding);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create image"));
        },
        "image/jpeg",
        0.92,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location picker state
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [pickedName, setPickedName] = useState<string>("");
  const [showPicker, setShowPicker] = useState(true);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

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

  function handleLocationSelect(lat: number, lng: number, name: string) {
    setPickedLat(lat);
    setPickedLng(lng);
    setPickedName(name);
    setShowPicker(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image || pickedLat == null || pickedLng == null) return;

    setLoading(true);
    setError(null);

    if (watermarkedUrl) {
      URL.revokeObjectURL(watermarkedUrl);
      setWatermarkedUrl(null);
    }

    try {
      const blob = await applyWatermark(image, pickedLat, pickedLng);
      const url = URL.createObjectURL(blob);
      setWatermarkedUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setImage(null);
    setPreview(null);
    setError(null);
    setPickedLat(null);
    setPickedLng(null);
    setPickedName("");
    setShowPicker(true);
    if (watermarkedUrl) {
      URL.revokeObjectURL(watermarkedUrl);
      setWatermarkedUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const locationReady = pickedLat != null && pickedLng != null && pickedName !== "";

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
                download="tagaloc.jpg"
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
            {/* Image upload */}
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

            {/* Location picker or confirmed location */}
            {showPicker ? (
              <LocationPicker
                token={token}
                onSelect={handleLocationSelect}
                initialName={pickedName}
              />
            ) : (
              <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {pickedName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {pickedLat?.toFixed(6)}, {pickedLng?.toFixed(6)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="shrink-0 ml-3 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
                >
                  Change
                </button>
              </div>
            )}

            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={!image || !locationReady || loading}
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
