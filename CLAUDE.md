# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Tagaloc — Geolocation Watermark App

Upload a picture, enter a location name, the app geocodes it to latitude/longitude, watermarks the coords on the bottom-right of the image, and lets the user download the result. Deployed to Vercel.

See `PLAN.md` for full spec.

## Stack

- **Next.js 16.2** (App Router, Turbopack default, `src/` directory)
- **React 19.2**
- **TypeScript 5**
- **Tailwind CSS 4**

## Commands

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Production build
npm run start     # Start production server
npx eslint .      # Lint (next lint removed in v16)
npx next typegen  # Generate typed PageProps/LayoutProps/RouteContext helpers
```

## Architecture (from PLAN.md)

Two server-side pieces needed:

1. **Geocoding** — text location → lat/lng. Use a geocoding API (Nominatim free tier, Google Geocoding, or similar). Called on the server (Server Action or Route Handler) when user submits.

2. **Watermark rendering** — overlay lat/lng text on bottom-right of image. Options:
   - Canvas API via `sharp` (Node.js) in a Route Handler — best for server-side image manipulation
   - Canvas API in browser (client-side) — simpler, no dependency, but heavier for large images
   - Recommended: server-side with `sharp` since it produces consistent downloadable output

Data flow:
```
User uploads image + enters location text
  → POST to Server Action or Route Handler
  → Geocode location → lat/lng
  → Overlay "lat, lng" text on image bottom-right via sharp
  → Return watermarked image as downloadable blob / data URL
```

## Next.js 16 Critical Notes

**This is Next.js 16 — APIs differ from v14/v15.** Read `node_modules/next/dist/docs/` before writing Next.js API code.

Breaking changes that matter here:
- **Async params/searchParams**: `params` and `searchParams` in pages/layouts are Promises. Must `await` them. Use `npx next typegen` for `PageProps<'/path'>` helper.
- **`middleware.ts` → `proxy.ts`**: Rename file, export `proxy` function instead of `middleware`.
- **`revalidateTag(tag, profile)`**: Second argument required (e.g., `'max'`).
- **No `next lint`**: Use `npx eslint .` directly.
- **No runtime config**: Use env vars directly. `NEXT_PUBLIC_` prefix for client-accessible ones.
- **Turbopack default**: Both dev and build use Turbopack. Remove `--turbopack` flags.

Typegen usage for type-safe pages:
```tsx
// app/page.tsx — after running `npx next typegen`
export default async function Page(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  // ...
}
```

## Code Style

TypeScript strict mode. Use `interface` for object shapes, `type` for unions/intersections. No `any` — use `unknown` and narrow. No `React.FC`. No `console.log` in production code.

```typescript
interface WatermarkRequest {
  image: File
  location: string
}

type WatermarkResult = {
  success: true
  data: Blob
} | {
  success: false
  error: string
}
```

Exported functions must have explicit parameter and return types. Use Zod for input validation.

Secrets (API keys) go in environment variables, never hardcoded. Prefix client-safe vars with `NEXT_PUBLIC_`.
