import { locatorAccess } from "@/lib/locator";
import { MODULES } from "@/lib/access";
import { panePage, paneHeaders } from "@/lib/word";

// /word/instrumente — the "Instrumente" button of the UVALO tab in Word: the add-in's tools (open in the pane) and the
// platform's tools (open in the browser), with the account. New tools show up here without a new manifest.
export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  foto: "M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  pdf: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6",
  localizare: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
  amplasament: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 12l6-6",
  comparabile: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14",
};
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
const card = (href: string, icon: string, name: string, desc: string, browser = false) =>
  `<a class="card" href="${href}"${browser ? ' data-browser="1"' : ""}><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[icon]}"/></svg></span><span><b>${esc(name)}</b><small>${esc(desc)}</small></span></a>`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = await locatorAccess("word");
  if ("status" in a) {
    if (a.status === 401) return Response.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname)}`, req.url), 303);
    if ("maintenance" in a && a.maintenance) return Response.redirect(new URL("/mentenanta", req.url), 303);
  }
  const c = "c" in a ? a.c : undefined;
  const word = !("status" in a);
  const offPart = (p: string) => (c && !c.super && c.off.includes(`word.${p}`) ? "Dezactivat temporar." : null);
  const web = MODULES.filter((m) => m.key !== "word" && c?.modules.includes(m.key));
  const body = [
    `<h1>Instrumentele UVALO</h1>`,
    `<div class="sec">În Word</div>`,
    word
      ? card("/word/anexe?mode=photo", "foto", "Anexă foto", offPart("photo") ?? "Pozele de la inspecție, ordonate, cu legende, câte vrei pe pagină.") +
        card("/word/anexe?mode=pdf", "pdf", "Anexă documente", offPart("pdf") ?? "Extras CF, releveu, autorizații: pagină cu pagină, cu titlu pe fiecare document.")
      : `<p>${esc(c?.block ?? "Abonamentul firmei tale nu include UVALO pentru Word.")} Scrie-ne la <a href="mailto:office@valuefy.ro">office@valuefy.ro</a>.</p>`,
    word && c?.modules.includes("comparabile")
      ? card("/word/comparabile", "comparabile", "Localizator de comparabile", offPart("comps") ?? "În fereastră mare, în Word; harta și tabelul se inserează în raport.")
      : "",
    web.filter((m) => !(word && m.key === "comparabile")).length
      ? `<div class="sec">Se deschid în browser</div>` + web.filter((m) => !(word && m.key === "comparabile")).map((m) => card(m.href, m.key, m.name, m.desc, true)).join("")
      : "",
    c ? `<div class="me">Conectat ca <b>${esc(c.user.name || c.user.email)}</b>${c.org ? ` · ${esc(c.org.name)}` : ""}<br><a href="/word" data-browser="1">Ajutor și instalare</a></div>` : "",
  ].join("");
  // Platform pages open in the browser (Office.context.ui.openBrowserWindow), not in the narrow pane.
  const script = `<script>
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-browser]");if(!a)return;e.preventDefault();var u=new URL(a.getAttribute("href"),location.href).href;
try{if(window.Office&&Office.context&&Office.context.ui&&Office.context.ui.openBrowserWindow){Office.context.ui.openBrowserWindow(u);return}}catch(x){}window.open(u,"_blank")});
if(window.Office&&Office.onReady)Office.onReady(function(){});
</script>`;
  return new Response(panePage("Instrumente", body, script), { headers: paneHeaders });
}
