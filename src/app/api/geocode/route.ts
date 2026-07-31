import { NextResponse } from "next/server";

const GOOGLE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

interface Suggestion {
  label: string;
  lat: string;
  lon: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const googleKey = process.env.GOOGLE_GEOCODING_API_KEY;
    let suggestions: Suggestion[];

    if (googleKey) {
      suggestions = await searchGoogle(q.trim(), googleKey);
      // If Google returned nothing, fall back to Mapbox
      if (suggestions.length === 0) {
        suggestions = await searchMapbox(q.trim());
      }
    } else {
      suggestions = await searchMapbox(q.trim());
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

async function searchGoogle(query: string, key: string): Promise<Suggestion[]> {
  const url = `${GOOGLE_URL}?address=${encodeURIComponent(query)}&region=id&key=${key}`;

  const res = await fetch(url);

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  if (data.status !== "OK" || data.results.length === 0) {
    return [];
  }

  return data.results.slice(0, 5).map((r) => ({
    label: r.formatted_address,
    lat: String(r.geometry.location.lat),
    lon: String(r.geometry.location.lng),
  }));
}

async function searchMapbox(query: string): Promise<Suggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return [];

  const url = `${MAPBOX_URL}/${encodeURIComponent(query)}.json?access_token=${token}&country=id&limit=5&language=id`;

  const res = await fetch(url);

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as {
    features: Array<{
      place_name: string;
      center: [number, number];
    }>;
  };

  return data.features.map((f) => ({
    label: f.place_name,
    lat: String(f.center[1]),
    lon: String(f.center[0]),
  }));
}
