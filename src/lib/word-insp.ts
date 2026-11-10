import type { Insp } from "./insp";
import { compSummary, fmtWhen } from "./insp-shared";

// UVALO pentru Word → Anexă foto → „Din inspecții”: the inspection sheet as HTML for Word (insertHtml at the cursor). Plain tables with
// thin borders and no font family, so the text takes the document's font; the rows the sheet marks "not in the PDF" stay out.

const e = (s: unknown) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
const nf = (n: number | null | undefined, d = 2) => (n == null ? "" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));
const ans = (v: string | string[] | undefined, unit?: string) => (Array.isArray(v) ? v.join(", ") : v ? `${v}${unit ? ` ${unit}` : ""}` : "");
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" }) : "");

const TBL = 'border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #9a9a9a;font-size:9.5pt"';
const TH = 'style="border:1px solid #9a9a9a;background:#f2f2f2;text-align:left;font-weight:bold"';
const TD = 'style="border:1px solid #9a9a9a;vertical-align:top"';
const KEY = 'style="border:1px solid #9a9a9a;vertical-align:top;width:42%;color:#444"';
const H = (t: string) => `<p style="margin:10pt 0 4pt;font-weight:bold;font-size:10.5pt">${e(t)}</p>`;
const rows = (r: [string, string][]) => `<table ${TBL}>${r.map(([k, v]) => `<tr><td ${KEY}>${e(k)}</td><td ${TD}>${e(v)}</td></tr>`).join("")}</table>`;

/** Whether the sheet has anything to put in a report: started on the phone (or finished). */
export const sheetReady = (x: Pick<Insp, "status">) => ["lucru", "gata", "pred"].includes(x.status);

export function sheetHtml(x: Insp) {
  const out: string[] = [];
  const no = x.sheet_no ? `nr. ${x.sheet_no}${x.sheet_at ? ` din ${day(x.sheet_at)}` : ""}` : x.code;
  out.push(`<p style="margin:0 0 6pt;font-weight:bold;font-size:12pt">FIȘA DE INSPECȚIE ${e(no)}</p>`);
  const rooms = x.room_answers.length ? x.room_answers : x.rooms;
  const util = rooms.reduce((s, r) => s + (r.a ?? 0), 0);
  const meta: [string, string][] = ([
    ["Tipul imobilului", x.prop_type ?? ""], ["Adresa", x.address], ["Nr. cadastral", x.cad_nr ?? ""], ["Carte funciară", x.cf_nr ?? ""],
    ["Localitate", [x.uat, x.county].filter(Boolean).join(", ")], ["Suprafață utilă (acte)", x.area_util ? `${nf(x.area_util)} mp` : ""],
    ["Teren (acte)", x.area_land ? `${nf(x.area_land, 0)} mp` : ""],
    ["Data inspecției", x.finished_at ? day(x.finished_at) : x.started_at ? day(x.started_at) : x.scheduled_at ? fmtWhen(x.scheduled_at) : ""],
    ["Inspecție efectuată de", [x.assignee_name, x.assignee_legit && `leg. ANEVAR ${x.assignee_legit}`].filter(Boolean).join(", ")],
    ["Persoana prezentă", x.signed_name ?? ""],
  ] as [string, string][]).filter(([, v]) => v);
  out.push(H("Imobilul"), rows(meta));
  for (const g of x.template.groups) {
    const r = g.qs.filter((q) => q.pdf !== false).map((q) => [q.t, q.kind === "comp" ? compSummary(q, x.answers) : ans(x.answers[q.id], q.unit)] as [string, string]).filter(([, v]) => v);
    if (r.length) out.push(H(g.name), rows(r));
  }
  if (rooms.length) {
    const fin = !!x.template.rooms || x.room_answers.some((r) => r.floor);
    const head = ["Încăpere", "Suprafață (mp)", ...(fin ? ["Pardoseală", "Pereți", "Plafon", "Stare"] : [])];
    out.push(H(`Încăperi${util ? ` · ${nf(util)} mp utili` : ""}`), `<table ${TBL}><tr>${head.map((h) => `<th ${TH}>${e(h)}</th>`).join("")}</tr>${rooms.map((r) => {
      const ra = r as { floor?: string; walls?: string; ceiling?: string; state?: string };
      const cells = [r.n, r.a ? nf(r.a) : "", ...(fin ? [ra.floor, ra.walls, ra.ceiling, ra.state] : [])];
      return `<tr>${cells.map((c) => `<td ${TD}>${e(c ?? "")}</td>`).join("")}</tr>`;
    }).join("")}</table>`);
  }
  const f = x.findings ?? {};
  const find = ([["Diferențe față de acte", f.diff], ["Defecte vizibile", f.defects], ["Observații", f.notes]] as [string, string | undefined][]).filter(([, v]) => v) as [string, string][];
  if (find.length) out.push(H("Constatări"), rows(find));
  if (x.gps_lat != null && x.gps_lng != null) {
    out.push(H("Locația inspecției"), rows([["Coordonate (WGS84)", `${x.gps_lat.toFixed(6)}, ${x.gps_lng.toFixed(6)}`],
      ["Sursa", x.gps_src === "manual" ? "pin pus manual pe hartă" : `GPS-ul telefonului${x.gps_acc ? ` (±${Math.round(x.gps_acc)} m)` : ""}`]]));
  }
  return out.join("");
}
