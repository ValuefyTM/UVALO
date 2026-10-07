import { headers } from "next/headers";

/** Public origin of the request (https://tools.valuefy.ro, https://tools.<account>.workers.dev, http://localhost:3300…). */
export async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3300";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
