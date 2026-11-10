import type { Metadata, Viewport } from "next";
import "./globals.css";
import { envLabel } from "@/lib/config";

// The preview of a shared link (WhatsApp, Facebook, LinkedIn…): the same image everywhere, so a link that is redirected
// (e.g. to /mentenanta) still shows it. public/og-uvalo.jpg, 1200×630.
const OG_IMAGE = { url: "/og-uvalo.jpg", width: 1200, height: 630, alt: "UVALO: colaborări și inspecții pentru evaluatori" };
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://app.uvalo.ro"),
  title: "UVALO",
  description: "Colaborări între evaluatori ANEVAR și inspecții de pe telefon, plus localizatorul cadastral, analiza amplasamentului și anexele în Word.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website", siteName: "UVALO", locale: "ro_RO",
    title: "UVALO · Platforma evaluatorilor autorizați din România",
    description: "Găsești un coleg pentru inspecție în câteva minute. Pregătești inspecția pe web, fișa se completează pe telefon, la fața locului. Cont gratuit.",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111111" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // outside production (APP_ENV staging / local) a red strip at the bottom of every page rendered per request
  const env = envLabel();
  return (
    <html lang="ro">
      <head>
        <link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        {env && <div className="envBar">{env} · <a href="/dev/mail">emailuri</a></div>}
      </body>
    </html>
  );
}
