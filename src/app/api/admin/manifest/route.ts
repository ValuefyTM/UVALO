/** Web app manifest of the admin app ("UVALO Admin"): /admin installed on the phone. Public (browsers fetch it without cookies). */
export function GET() {
  return Response.json(
    {
      name: "UVALO Admin", short_name: "UVALO Admin", description: "Administrarea platformei UVALO: statistici, conturi, solicitări, instrumente.",
      // scope "/" so that the login (/login?next=/admin) stays inside the app; id ≠ the other UVALO apps
      lang: "ro", id: "/admin", start_url: "/admin?app=1", scope: "/", display: "standalone", orientation: "portrait",
      background_color: "#111111", theme_color: "#111111",
      icons: [
        { src: "/loc-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/loc-icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/loc-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
