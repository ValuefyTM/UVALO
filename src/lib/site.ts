import { headers } from "next/headers";

/**
 * Public origin of the app (https://app.uvalo.ro, https://tools.<account>.workers.dev, http://localhost:8787…): APP_URL
 * when set, otherwise the Host the request came to. Never x-forwarded-host, which anyone can send: these links go into
 * emails (sign-in, invitations).
 */
export async function origin() {
  const set = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (set) return set;
  const host = (await headers()).get("host") ?? "localhost:3300";
  return `${/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https"}://${host}`;
}
