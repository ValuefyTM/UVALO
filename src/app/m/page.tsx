import type { Metadata, Viewport } from "next";
import { MobileApp } from "@/components/mobile/MobileApp";

// The phone app (PWA). Served at "/" on inspectii.uvalo.ro (worker.ts rewrites it here); the data comes from /api/m/*.
export const metadata: Metadata = {
  title: "UVALO Inspecții",
  description: "Inspecțiile tale pe teren: fișa, fotografiile cu ora și locul, semnătura.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Inspecții", statusBarStyle: "black" },
  icons: { apple: "/loc-icon-apple.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#141414" };

export default function MobilePage() {
  return <MobileApp />;
}
