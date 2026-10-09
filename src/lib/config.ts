// Server-only: what the app is and where it runs, from the environment (wrangler.jsonc "vars" per environment, .dev.vars
// locally). Changing the domain or the name is a change here, not in the code.
import { headers } from "next/headers";

export type AppEnv = "production" | "staging" | "local";

/** production (default), staging (the test environment in Cloudflare) or local (wrangler dev). */
export const appEnv = (): AppEnv => {
  const v = (process.env.APP_ENV ?? "").trim();
  return v === "staging" || v === "local" ? v : "production";
};

export const appName = () => process.env.APP_NAME?.trim() || "UVALO";
export const supportEmail = () => process.env.SUPPORT_EMAIL?.trim() || "office@valuefy.ro";

/**
 * The public address of the app, for links in emails (login, invitations, recommendations). APP_URL when set (always in
 * Cloudflare); otherwise the Host of the request, never x-forwarded-host, which anyone can send.
 */
export async function appUrl() {
  const set = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (set) return set;
  const host = (await headers()).get("host") ?? "localhost:8787";
  return `${/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https"}://${host}`;
}

/** A strip on every page outside production, so the test environment is never mistaken for the real one. */
export const envLabel = () => (appEnv() === "staging" ? "MEDIU DE TEST · nu este platforma reală" : appEnv() === "local" ? "LOCAL · mediu de dezvoltare" : "");
export const envBanner = () => {
  const l = envLabel();
  return l ? `<div style="position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b3261e;color:#fff;font:700 11px/1.2 Verdana,sans-serif;letter-spacing:.06em;text-align:center;padding:5px 8px;pointer-events:none">${l} · <a href="/dev/mail" style="color:#fff;pointer-events:auto">emailuri</a></div>` : "";
};
