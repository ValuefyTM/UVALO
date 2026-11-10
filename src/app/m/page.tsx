import type { Metadata, Viewport } from "next";
import { MobileApp } from "@/components/mobile/MobileApp";

// The phone app (PWA). Served at "/" on inspectii.uvalo.ro (worker.ts rewrites it here); the data comes from /api/m/*.
export const metadata: Metadata = {
  title: "UVALO",
  description: "Inspecțiile tale pe teren: fișa, fotografiile cu ora și locul, semnătura.",
  appleWebApp: { capable: true, title: "UVALO", statusBarStyle: "black" },
  icons: { apple: "/loc-icon-apple.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#141414" };

export default function MobilePage() {
  // with credentials: the manifest puts a sign-in token in start_url for the signed-in person (see /api/m/manifest)
  return <><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" /><MobileApp /></>;
}
