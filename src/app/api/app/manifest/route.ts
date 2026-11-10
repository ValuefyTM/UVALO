import { headers } from "next/headers";
import { isPhoneUa } from "@/lib/ua";

/**
 * Web app manifest of the platform (app.uvalo.ro) — installable only on a computer (Chrome / Edge: the icon in the address bar,
 * "Instalează pe calculator" in the menu). On phones the inspection app (inspectii.uvalo.ro) is the one to install: the link is not
 * rendered there (AppShell) and this route answers 404 to phone browsers. Public (browsers fetch it without cookies).
 */
export async function GET() {
  if (isPhoneUa((await headers()).get("user-agent") ?? "")) return new Response("Not found", { status: 404 });
  return Response.json(
    {
      name: "UVALO", short_name: "UVALO", description: "Platforma evaluatorilor autorizați: localizator cadastral, inspecții, colaborări.",
      // id ≠ "UVALO Admin" (/admin); scope "/" so the login stays inside the window
      lang: "ro", id: "/", start_url: "/?app=1", scope: "/", display: "standalone",
      background_color: "#111111", theme_color: "#111111",
      icons: [
        { src: "/loc-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/loc-icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/loc-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600", Vary: "User-Agent" } },
  );
}
