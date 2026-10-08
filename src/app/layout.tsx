import type { Metadata, Viewport } from "next";
import "./globals.css";
import { connection } from "next/server";
import { envLabel } from "@/lib/config";

export const metadata: Metadata = {
  title: "VALUEFY Tools",
  description: "Instrumente pentru evaluatori: localizator cadastral și altele.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111111" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection(); // per request: the environment (APP_ENV) is read when serving, not at build time
  const env = envLabel();
  return (
    <html lang="ro">
      <body>
        {children}
        {env && <div className="envBar">{env} · <a href="/dev/mail">emailuri</a></div>}
      </body>
    </html>
  );
}
