import { getDb } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { installToken } from "@/lib/insp";

/**
 * Web app manifest of the phone app (inspectii.uvalo.ro): installable ("Adaugă pe ecranul principal").
 * Fetched with the session cookie (<link rel="manifest" crossorigin="use-credentials">): for a signed-in person the start_url carries a
 * one-time sign-in token (3 days), so the app added to the home screen on iPhone (own cookies, separate from Safari) opens already signed in.
 * `auto=1`: the app tries the token quietly and falls back to the sign-in screen if it was used or expired.
 */
export async function GET() {
  const db = await getDb();
  let start = "/";
  try {
    const s = db ? await currentSession(db) : null;
    if (s && db) start = `/?pair=${encodeURIComponent(await installToken(db, s.user.id))}&u=${encodeURIComponent(s.user.id)}&auto=1`;
  } catch {}
  return Response.json(
    {
      name: "UVALO", short_name: "UVALO", description: "Inspecțiile tale pe teren: fișa, fotografiile, semnătura.",
      lang: "ro", id: "/", start_url: start, scope: "/", display: "standalone", orientation: "portrait",
      background_color: "#141414", theme_color: "#141414",
      icons: [
        { src: "/loc-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/loc-icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/loc-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": start === "/" ? "public, max-age=3600" : "private, no-store" } },
  );
}
