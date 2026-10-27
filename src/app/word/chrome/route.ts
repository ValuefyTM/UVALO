import { locatorAccess } from "@/lib/locator";
import { track } from "@/lib/track";
import { panePage, paneHeaders } from "@/lib/word";

// /word/chrome — "Comparabile din Chrome" in Word: the listings captured with UVALO pentru Chrome and sent with
// "Trimite în Word" (/api/chrome/batch), inserted at the cursor (public/word/src/chrome-pane.js).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = await locatorAccess("word");
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname)}`, req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
    return new Response(panePage("Comparabile din Chrome", `<h1>Nu este disponibil</h1><p>${a.c?.block ?? "Abonamentul firmei tale nu include UVALO pentru Word."}</p>`), { status: a.status, headers: paneHeaders });
  }
  if (!a.c.super && a.c.off.includes("word.chrome")) {
    return new Response(panePage("Comparabile din Chrome", `<h1>Dezactivat temporar</h1><p>Preluarea comparabilelor din Chrome este oprită temporar de administratorii UVALO.</p><a class="btn ghost" href="/word/instrumente">← Instrumentele UVALO</a>`), { status: 403, headers: paneHeaders });
  }
  await track(a.db, a.c, "word", "pane", "chrome");
  const body = `
<h1>Comparabile din Chrome</h1>
<p>Anunțurile capturate cu <b>UVALO pentru Chrome</b> și trimise cu <b>„Trimite în Word”</b>. Bifezi ce intră și le inserezi la cursor, fiecare cu sursa și data capturii.</p>
<div id="list"><p>Se încarcă…</p></div>
<div id="opts" hidden>
  <div class="sec">Așezare</div>
  <label class="card" style="align-items:center;cursor:pointer"><input type="checkbox" id="optGroup" checked> <span>Numele grupului ca titlu</span></label>
  <label class="card" style="align-items:center;cursor:pointer"><input type="checkbox" id="optBreak" checked> <span>Fiecare comparabilă pe pagină nouă</span></label>
  <button type="button" class="btn" id="insert">Inserează în raport</button>
  <p style="font-size:11px">Pune cursorul pe un rând gol, în afara tabelelor. Inserarea se poate anula cu Ctrl+Z.</p>
</div>
<div id="capBox"></div>
<div id="status" class="card" hidden></div>
<a class="btn ghost" href="/word/instrumente">← Instrumentele UVALO</a>`;
  return new Response(panePage("Comparabile din Chrome", body, `<script src="/word/src/cap-width.js"></script><script src="/word/src/chrome-pane.js"></script>`), { headers: paneHeaders });
}
