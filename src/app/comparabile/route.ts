import { locatorAccess, locatorAsset } from "@/lib/locator";
import { track } from "@/lib/track";

// /comparabile — the subject property and its comparables on a map (no Google key), for people whose firm has the module.
// The page lives with the locator's files (localizare-data/comparabile.html), served only by the worker.
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: Request) {
  const a = await locatorAccess("comparabile");
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL("/login", req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
    const why = a.c?.block ?? "Abonamentul firmei tale nu include localizarea comparabilelor.";
    return new Response(blocked(why), { status: a.status, headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
  }
  const page = await locatorAsset("comparabile.html", req);
  if (!page) return new Response("Pagina nu este disponibilă momentan.", { status: 503, headers: PRIVATE });
  await track(a.db, a.c, "comparabile", "page");
  // The report header starts with the person's name and firm (changeable in the page's settings).
  const org = a.c.org && a.c.org.name.trim().toLowerCase() !== a.c.user.name.trim().toLowerCase() ? a.c.org.name : "";
  const me = { name: a.c.user.name, company: org || a.c.user.name, subtitle: a.c.user.anevar_no ? `Evaluator autorizat ANEVAR · legitimația ${a.c.user.anevar_no}` : "" };
  const html = (await page.text()).replace("</head>", `<link rel="icon" href="/icon.svg" type="image/svg+xml"><script>window.UVALO_USER=${JSON.stringify(me).replace(/</g, "\\u003c")}</script></head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE } });
}

function blocked(why: string) {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Localizare comparabile · UVALO</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#F2ECE0;color:#111111;font-family:Verdana,Geneva,sans-serif}
.box{width:min(440px,100%);background:#fff;border:1px solid #E2D8C4;border-radius:22px;padding:30px 26px;display:flex;flex-direction:column;gap:14px}h1{margin:0;font-size:21px}p{margin:0;font-size:14px;line-height:1.6;color:#4A4A4A}a{color:#9A5F00;font-weight:700}</style></head>
<body><div class="box"><h1>Localizarea comparabilelor nu este disponibilă</h1><p>${why.replace(/[<>&]/g, "")}</p><p>Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să activăm accesul.</p><p><a href="/">← Înapoi la UVALO</a></p></div></body></html>`;
}
