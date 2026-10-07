import { locatorAccess, locatorAsset } from "@/lib/locator";
import { track } from "@/lib/track";
import { gmapsConfig } from "@/lib/gmaps";

// /localizare — cadastral locator (cadastral plans, Timiș), for people whose firm has the module.
export const dynamic = "force-dynamic";

// The origin goes along with the map images, so a Google key restricted to tools.valuefy.ro is accepted.
const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "strict-origin-when-cross-origin" };

// Installable on the phone (PWA): manifest, icons, and a service worker that keeps the map usable with a weak signal.
const PWA_HEAD = `<link rel="manifest" href="/api/localizare/manifest"><link rel="apple-touch-icon" href="/loc-icon-apple.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Localizator"><meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>.vfBack{display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:13px;font-weight:700;color:#9a5f00;text-decoration:none;padding:6px 10px;border-radius:999px;border:1px solid #f5d9a6;background:#fdf1dc}</style>`;
const PWA_SCRIPT = `<script>if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/api/localizare/sw",{scope:"/localizare"}).catch(function(){})})</script>`;
// Back to the VALUEFY Tools home, in the page header.
const BACK = `<script>(function(){var h=document.querySelector("header");if(!h)return;var a=document.createElement("a");a.href="/";a.className="vfBack";a.textContent="← VALUEFY Tools";h.appendChild(a)})()</script>`;

export async function GET(req: Request) {
  const a = await locatorAccess();
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL("/login", req.url), 303);
    const why = a.c?.block ?? "Abonamentul firmei tale nu include localizarea cadastrală.";
    return new Response(blocked(why), { status: a.status, headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
  }
  const page = await locatorAsset("index.html", req);
  if (!page) return new Response("Pagina nu este disponibilă momentan.", { status: 503, headers: PRIVATE });
  const [gm] = await Promise.all([gmapsConfig(), track(a.db, a.c, "localizare", "page")]);
  // Google maps (when the key is set in Cloudflare); the page falls back to the free maps without it.
  const GM = gm ? `<script>window.VF_GMAPS=${JSON.stringify(gm).replace(/</g, "\\u003c")}</script>` : "";
  const html = (await page.text())
    .replace("</head>", `${PWA_HEAD}${GM}</head>`)
    .replace("</body>", `${BACK}<script src="/api/localizare/script" defer></script><script src="/api/localizare/track-js" defer></script>${PWA_SCRIPT}</body>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
}

function blocked(why: string) {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Localizator cadastral · VALUEFY Tools</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#F2ECE0;color:#111111;font-family:Verdana,Geneva,sans-serif}
.box{width:min(440px,100%);background:#fff;border:1px solid #E2D8C4;border-radius:22px;padding:30px 26px;display:flex;flex-direction:column;gap:14px}h1{margin:0;font-size:21px}p{margin:0;font-size:14px;line-height:1.6;color:#4A4A4A}a{color:#9A5F00;font-weight:700}</style></head>
<body><div class="box"><h1>Localizatorul cadastral nu este disponibil</h1><p>${why.replace(/[<>&]/g, "")}</p><p>Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să activăm accesul.</p><p><a href="/">← Înapoi la VALUEFY Tools</a></p></div></body></html>`;
}
