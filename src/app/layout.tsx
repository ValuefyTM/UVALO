import type { Metadata, Viewport } from "next";
import "./globals.css";

// The preview of a shared link (WhatsApp, Facebook, LinkedIn…): the same image everywhere, so a link that is redirected
// (e.g. to /mentenanta) still shows it. public/og-uvalo.jpg, 1200×630.
const OG_IMAGE = { url: "/og-uvalo.jpg", width: 1200, height: 630, alt: "UVALO: localizator cadastral pentru evaluatori" };
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://app.uvalo.ro"),
  title: "UVALO",
  description: "Instrumente pentru evaluatori: localizator cadastral și altele.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website", siteName: "UVALO", locale: "ro_RO",
    title: "UVALO · Platforma evaluatorilor autorizați din România",
    description: "Localizator cadastral gratuit: orice imobil din planurile ANCPI, după număr cadastral, topo sau adresă. Fișa în PDF și Word.",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111111" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
