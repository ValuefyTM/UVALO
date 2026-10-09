import { locatorAccess, locatorAsset } from "@/lib/locator";
import { track } from "@/lib/track";
import { gmapsConfig, hasGoogle } from "@/lib/gmaps";

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
// Back to the UVALO home, in the page header.
const BACK = `<script>(function(){var h=document.querySelector("header");if(!h)return;var a=document.createElement("a");a.href="/";a.className="vfBack";a.textContent="← UVALO";h.appendChild(a)})()</script>`;

// First opening: the data is informative, from unofficial cadastral sources; it must be acknowledged once (kept on the account).
const NOTICE = `<div id="vfNotice" role="dialog" aria-modal="true" aria-labelledby="vfNoticeT" style="position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Verdana,Geneva,sans-serif">
<div style="width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#111;border-radius:22px;padding:26px 24px 22px;box-shadow:0 30px 80px -20px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px">
<span style="width:48px;height:48px;border-radius:14px;background:#fdf1dc;color:#9a5f00;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800" aria-hidden="true">!</span>
<h2 id="vfNoticeT" style="margin:0;font:700 20px/1.3 Verdana,Geneva,sans-serif;letter-spacing:-.02em;text-transform:none;color:#111">Înainte să folosești localizatorul</h2>
<p style="margin:0;font-size:14px;line-height:1.6">Datele afișate au <b>caracter informativ</b> și provin din <b>surse cadastrale neoficiale</b>. Nu înlocuiesc extrasul de carte funciară, documentația cadastrală sau alte documente oficiale emise de OCPI / ANCPI.</p>
<p style="margin:0;font-size:14px;line-height:1.6">Pot exista diferențe față de evidențele oficiale sau de situația din teren: contururi, suprafețe, numere cadastrale, coordonate.</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4a4a4a">Platforma UVALO <b style="color:#111">nu este responsabilă pentru eventualele diferențe</b> și nici pentru deciziile luate pe baza acestor informații. Verifică întotdeauna datele în documentele oficiale.</p>
<button type="button" id="vfNoticeOk" style="margin-top:6px;height:50px;border:0;border-radius:999px;background:#111;color:#fff;font:700 15px Verdana,Geneva,sans-serif;cursor:pointer">Am luat la cunoștință</button>
</div></div>
<script>(function(){var d=document.getElementById("vfNotice"),b=document.getElementById("vfNoticeOk");document.documentElement.style.overflow="hidden";b.focus();
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&document.getElementById("vfNotice"))e.preventDefault()},true);
b.onclick=function(){b.disabled=true;b.textContent="Se salvează…";fetch("/api/localizare/ack",{method:"POST"}).catch(function(){}).finally(function(){d.remove();document.documentElement.style.overflow=""})}})()</script>`;

export async function GET(req: Request) {
  const a = await locatorAccess();
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL("/login", req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
    const why = a.c?.block ?? "Abonamentul firmei tale nu include localizarea cadastrală.";
    return new Response(blocked(why), { status: a.status, headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
  }
  const page = await locatorAsset("index.html", req);
  if (!page) return new Response("Pagina nu este disponibilă momentan.", { status: 503, headers: PRIVATE });
  const [gm, ack] = await Promise.all([
    hasGoogle(a.c) ? gmapsConfig() : null,
    a.db.prepare("SELECT loc_ack_at FROM users WHERE id = ?").bind(a.c.user.id).first<{ loc_ack_at: string | null }>(),
    track(a.db, a.c, "localizare", "page"),
  ]);
  // Google maps only for paid plans with the key set in Cloudflare; otherwise the free maps.
  const GM = gm ? `<script>window.VF_GMAPS=${JSON.stringify(gm).replace(/</g, "\\u003c")}</script>` : "";
  const html = (await page.text())
    .replace("</head>", `${PWA_HEAD}${GM}</head>`)
    .replace("</body>", `${ack?.loc_ack_at ? "" : NOTICE}${BACK}<script src="/api/localizare/script" defer></script><script src="/api/localizare/track-js" defer></script>${PWA_SCRIPT}</body>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
}

function blocked(why: string) {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Localizator cadastral · UVALO</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#F2ECE0;color:#111111;font-family:Verdana,Geneva,sans-serif}
.box{width:min(440px,100%);background:#fff;border:1px solid #E2D8C4;border-radius:22px;padding:30px 26px;display:flex;flex-direction:column;gap:14px}h1{margin:0;font-size:21px}p{margin:0;font-size:14px;line-height:1.6;color:#4A4A4A}a{color:#9A5F00;font-weight:700}</style></head>
<body><div class="box"><h1>Localizatorul cadastral nu este disponibil</h1><p>${why.replace(/[<>&]/g, "")}</p><p>Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să activăm accesul.</p><p><a href="/">← Înapoi la UVALO</a></p></div></body></html>`;
}
