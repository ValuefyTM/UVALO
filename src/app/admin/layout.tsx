import type { Metadata, Viewport } from "next";

// The admin area is installable on the phone as its own app, "UVALO Admin" (manifest: /api/admin/manifest).
export const metadata: Metadata = {
  manifest: "/api/admin/manifest",
  appleWebApp: { capable: true, title: "UVALO Admin", statusBarStyle: "black" },
  icons: { apple: "/loc-icon-apple.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#111111" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
