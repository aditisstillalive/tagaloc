import { NextResponse } from "next/server";
import sharp from "sharp";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocode(location: string): Promise<GeocodeResult> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", location);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Tagaloc/1.0 (watermark app)",
      "Accept-Language": "en",
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status} ${res.statusText}`);
  }

  const results = (await res.json()) as GeocodeResult[];
  if (results.length === 0) {
    throw new Error(`Location not found: "${location}"`);
  }

  return results[0];
}

function formatCoordinate(value: string, decimals: number): string {
  const num = parseFloat(value);
  return num.toFixed(decimals);
}

function watermarkSvg(lat: string, lon: string, imgWidth: number, imgHeight: number): string {
  const text = `${formatCoordinate(lat, 6)}, ${formatCoordinate(lon, 6)}`;
  const fontSize = Math.max(16, Math.round(Math.min(imgWidth, imgHeight) * 0.035));
  const padding = Math.round(fontSize * 1.2);

  return `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      text {
        font-family: monospace;
        font-size: ${fontSize}px;
        fill: white;
        paint-order: stroke;
        stroke: black;
        stroke-width: 2px;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    </style>
    <text
      x="${imgWidth - padding}"
      y="${imgHeight - padding}"
      text-anchor="end"
    >${text}</text>
  </svg>`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const location = formData.get("location") as string | null;

    if (!imageFile || !location) {
      return NextResponse.json(
        { error: "Image and location are required." },
        { status: 400 },
      );
    }

    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Uploaded file must be an image." },
        { status: 400 },
      );
    }

    const locationTrimmed = location.trim();
    if (locationTrimmed.length === 0) {
      return NextResponse.json({ error: "Location cannot be empty." }, { status: 400 });
    }

    let geoResult: GeocodeResult;
    try {
      geoResult = await geocode(locationTrimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Geocoding failed";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      return NextResponse.json(
        { error: "Could not read image dimensions." },
        { status: 422 },
      );
    }

    const svgOverlay = watermarkSvg(geoResult.lat, geoResult.lon, metadata.width, metadata.height);
    const svgBuffer = Buffer.from(svgOverlay);

    const watermarked = await sharp(imageBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();

    return new NextResponse(watermarked, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="tagaloc-${Date.now()}.png"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
