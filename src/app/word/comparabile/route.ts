import { locatorAccess } from "@/lib/locator";
import { track } from "@/lib/track";
import { panePage, paneHeaders } from "@/lib/word";

// /word/comparabile — the "Comparabile" button of the UVALO tab in Word. The pane opens the comparables locator
// (/comparabile?word=1) in a large Word window; "Inserează în raport" there sends the map and the table back here
// (Office dialog messages) and this pane puts them in the document at the cursor (public/word/src/comps-pane.js).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = await locatorAccess("word");
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname)}`, req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
    const why = a.c?.off.includes("word") ? "UVALO pentru Word este dezactivat temporar." : a.c?.block ?? "Abonamentul firmei tale nu include UVALO pentru Word.";
    return new Response(panePage("Comparabile", `<h1>Nu este disponibil</h1><p>${why}</p>`), { status: a.status, headers: paneHeaders });
  }
  const { c } = a;
  const off = !c.super && c.off.includes("word.comps");
  const noModule = !c.modules.includes("comparabile");
  if (off || noModule) {
    const why = off || c.off.includes("comparabile") ? "Localizatorul de comparabile este dezactivat temporar de administratorii UVALO. Revine în curând." : "Abonamentul firmei tale nu include localizatorul de comparabile.";
    return new Response(panePage("Comparabile", `<h1>Nu este disponibil</h1><p>${why}</p><a class="btn ghost" href="/word/instrumente">← Instrumentele UVALO</a>`), { status: 403, headers: paneHeaders });
  }
  await track(a.db, c, "word", "pane", "comps");
  const body = `
<h1>Localizator de comparabile</h1>
<p>Harta se deschide într-o fereastră mare. Pune subiectul și comparabilele, apoi apasă <b>Inserează în raport</b>: harta și tabelul intră în document, la cursor.</p>
<button type="button" class="btn" id="open">Deschide harta comparabilelor</button>
<div id="status" class="card" hidden></div>
<div class="sec">Ce se inserează</div>
<label class="card" style="align-items:center;cursor:pointer"><input type="checkbox" id="optTitle" checked> <span>Titlu deasupra hărții</span></label>
<label class="card" style="align-items:center;cursor:pointer"><input type="checkbox" id="optTable" checked> <span>Tabelul comparabilelor, ca tabel Word</span></label>
<p style="font-size:11px">Pune cursorul pe un rând gol, în afara tabelelor, înainte de inserare. Panoul trebuie să rămână deschis cât lucrezi în fereastra hărții.</p>
<a class="btn ghost" href="/word/instrumente">← Instrumentele UVALO</a>`;
  return new Response(panePage("Comparabile", body, `<script src="/word/src/comps-pane.js"></script>`), { headers: paneHeaders });
}
