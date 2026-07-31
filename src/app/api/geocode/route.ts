import { NextResponse } from "next/server";

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

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const encoded = encodeURIComponent(q.trim());
    const url = `${MAPBOX_URL}/${encoded}.json?access_token=${token}&country=id&types=place,locality,region,district&autocomplete=true&limit=5&language=id`;

    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = (await res.json()) as {
      features: Array<{
        place_name: string;
        center: [number, number]; // [lng, lat]
      }>;
    };

    const suggestions: Suggestion[] = data.features.map((f) => ({
      label: f.place_name,
      lat: String(f.center[1]),
      lon: String(f.center[0]),
    }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
