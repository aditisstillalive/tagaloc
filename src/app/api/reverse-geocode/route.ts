import { NextResponse } from "next/server";

const MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ name: null });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ name: null });
  }

  try {
    const url = `${MAPBOX_URL}/${lng},${lat}.json?access_token=${token}&country=id&types=place,locality,region,district,poi&limit=1&language=id`;

    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json({ name: null });
    }

    const data = (await res.json()) as {
      features: Array<{ place_name: string }>;
    };

    const name = data.features[0]?.place_name ?? `${lat}, ${lng}`;
    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ name: null });
  }
}
