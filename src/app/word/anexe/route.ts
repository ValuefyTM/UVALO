import { locatorAccess, locatorAsset } from "@/lib/locator";
import { track } from "@/lib/track";
import { panePage, paneHeaders } from "@/lib/word";

// /word/anexe?mode=photo|pdf — the Word pane "Anexă foto" / "Anexă documente" (UVALO pentru Word). Word opens it from the
// UVALO tab; the page lives with the module pages (localizare-data/word-anexe.html), its scripts in public/word/.
// Signed out → the UVALO sign-in, inside the pane, then back here.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = await locatorAccess("word");
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
    const why = a.c?.off.includes("word") ? "UVALO pentru Word este dezactivat temporar de administratorii UVALO. Revine în curând." : a.c?.block ?? "Abonamentul firmei tale nu include UVALO pentru Word.";
    return new Response(panePage("Anexe", `<h1>Nu este disponibil</h1><p>${why}</p><p>Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să activăm accesul.</p>`), { status: a.status, headers: paneHeaders });
  }
  const mode = url.searchParams.get("mode") === "pdf" ? "pdf" : "photo";
  if (!a.c.super && a.c.off.includes(`word.${mode}`)) {
    return new Response(panePage(mode === "pdf" ? "Anexă documente" : "Anexă foto", `<h1>Dezactivat temporar</h1><p>${mode === "pdf" ? "Anexa documente" : "Anexa foto"} este oprită temporar de administratorii UVALO. Revine în curând.</p><a class="btn ghost" href="/word/instrumente">← Instrumentele UVALO</a>`), { status: 403, headers: paneHeaders });
  }
  const page = await locatorAsset("word-anexe.html", req);
  if (!page) return new Response("Pagina nu este disponibilă momentan.", { status: 503, headers: paneHeaders });
  await track(a.db, a.c, "word", "pane", mode);
  return new Response(await page.text(), { headers: paneHeaders });
}
