/** Web app manifest of /localizare: it can be installed on the phone ("Adaugă pe ecranul principal"). */
export function GET() {
  return Response.json(
    {
      name: "Localizator cadastral · UVALO",
      short_name: "Localizator",
      description: "Hartă cadastrală Timiș: număr cadastral, topo, adresă și locația ta pe parcelă.",
      lang: "ro",
      id: "/localizare",
      start_url: "/localizare",
      scope: "/localizare",
      display: "standalone",
      orientation: "any",
      background_color: "#111111",
      theme_color: "#111111",
      icons: [
        { src: "/loc-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/loc-icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/loc-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
