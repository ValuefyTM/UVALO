import { locatorAccess, locatorAsset } from "@/lib/locator";
import { uats } from "@/lib/cadastre";
import { track } from "@/lib/track";

// /amplasament — site analysis: the parcel from the cadastral plans (or an address), what is around it from
// OpenStreetMap, and the "Descrierea amplasamentului" text written with AI. Opened from the home search bar
// (?uat=&nr= or ?adr=), from the cadastral locator (?uat=&nr=) or directly.
// The page lives with the locator's files (localizare-data/amplasament.html), served only by the worker.
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: Request) {
  const a = await locatorAccess("amplasament");
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL("/login", req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
    const why = a.c?.block ?? "Abonamentul firmei tale nu include analiza amplasamentului.";
    return new Response(blocked(why), { status: a.status, headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
  }
  const [page, list] = await Promise.all([locatorAsset("amplasament.html", req), uats(req)]);
  if (!page) return new Response("Pagina nu este disponibilă momentan.", { status: 503, headers: PRIVATE });
  const sp = new URL(req.url).searchParams;
  await track(a.db, a.c, "amplasament", "page", sp.get("nr") ?? sp.get("adr") ?? null, sp.get("uat") ? { uat: sp.get("uat") } : undefined);
  // The report header starts with the person's name and firm; the plans the page can read (the locator's data).
  const org = a.c.org && a.c.org.name.trim().toLowerCase() !== a.c.user.name.trim().toLowerCase() ? a.c.org.name : "";
  const me = {
    name: a.c.user.name, company: org || a.c.user.name,
    subtitle: a.c.user.anevar_no ? `Evaluator autorizat ANEVAR · legitimația ${a.c.user.anevar_no}` : "",
    plans: a.c.super || a.c.modules.includes("localizare"),
  };
  const U = list.map((u) => ({ key: u.key, name: u.name, county: u.county ?? "Timiș", v: u.v ?? null, bb: u.bb ?? null }));
  const inject = `<link rel="icon" href="/icon.svg" type="image/svg+xml"><script>window.UVALO_USER=${JSON.stringify(me).replace(/</g, "\\u003c")};window.UVALO_UATS=${JSON.stringify(U).replace(/</g, "\\u003c")}</script>`;
  const html = (await page.text()).replace("</head>", `${inject}</head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
}

function blocked(why: string) {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analiza amplasamentului · UVALO</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#F2ECE0;color:#111111;font-family:Verdana,Geneva,sans-serif}
.box{width:min(440px,100%);background:#fff;border:1px solid #E2D8C4;border-radius:22px;padding:30px 26px;display:flex;flex-direction:column;gap:14px}h1{margin:0;font-size:21px}p{margin:0;font-size:14px;line-height:1.6;color:#4A4A4A}a{color:#9A5F00;font-weight:700}</style></head>
<body><div class="box"><h1>Analiza amplasamentului nu este disponibilă</h1><p>${why.replace(/[<>&]/g, "")}</p><p>Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să activăm accesul.</p><p><a href="/">← Înapoi la UVALO</a></p></div></body></html>`;
}
