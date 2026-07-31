import { NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

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
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", q.trim());
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "en");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Tagaloc/1.0 (watermark app)" },
    });

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const results = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;

    const suggestions: Suggestion[] = results.map((r) => ({
      label: r.display_name,
      lat: r.lat,
      lon: r.lon,
    }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
