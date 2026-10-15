/** Web app manifest of the phone app (inspectii.uvalo.ro): installable ("Adaugă pe ecranul principal"). */
export function GET() {
  return Response.json(
    {
      name: "UVALO", short_name: "UVALO", description: "Inspecțiile tale pe teren: fișa, fotografiile, semnătura.",
      lang: "ro", id: "/", start_url: "/", scope: "/", display: "standalone", orientation: "portrait",
      background_color: "#141414", theme_color: "#141414",
      icons: [
        { src: "/loc-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/loc-icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/loc-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
