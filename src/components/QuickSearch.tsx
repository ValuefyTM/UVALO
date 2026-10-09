"use client";

import { useMemo, useState } from "react";

type Uat = { key: string; name: string; county: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();

/** What the text asks for: an address / coordinates, or a cadastral / topo number with the UAT (and county) it names. */
function read(text: string, uats: Uat[]) {
  const q = text.trim();
  if (!q) return { kind: "empty" as const };
  if (/^-?\d{1,3}[.,]\d+\s*[,; ]\s*-?\d{1,3}[.,]\d+$/.test(q)) return { kind: "address" as const, q };
  // a number first ("413830 Giroc", "123/4, Giroc, Timiș"); anything else is an address
  const m = q.match(/^(?:nr\.?\s*|cad\.?\s*|cf\s*)?(\d[\w/.-]*)\s*[,;]?\s*(.*)$/i);
  if (!m) return { kind: "address" as const, q };
  const nr = m[1], place = ` ${norm(m[2])} `;
  if (!place.trim()) return { kind: "number" as const, nr, uat: null, ask: "missing" as const };
  const counties = [...new Set(uats.map((u) => u.county))].filter((c) => place.includes(` ${norm(c)} `));
  // the longest UAT name in the text (so "Becicherecu Mic" wins over a shorter name inside it)
  const hits = uats.filter((u) => place.includes(` ${norm(u.name)} `) && (!counties.length || counties.includes(u.county)));
  const best = Math.max(0, ...hits.map((u) => norm(u.name).length));
  const found = hits.filter((u) => norm(u.name).length === best);
  if (found.length === 1) return { kind: "number" as const, nr, uat: found[0] };
  if (found.length > 1) return { kind: "number" as const, nr, uat: null, ask: "county" as const, options: found };
  return { kind: "number" as const, nr, uat: null, ask: "unknown" as const };
}

/**
 * Home search bar of the cadastral locator: one text field. A cadastral or topo number goes with its locality
 * ("413830 Giroc", "413830, Giroc, Timiș"): the bar finds the UAT and county in the text and says so; without them it
 * asks for them. An address or coordinates go to the locator's address search.
 */
export function QuickSearch({ uats }: { uats: Uat[] }) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const r = useMemo(() => read(text, uats), [text, uats]);

  const msg = r.kind !== "number" || r.uat ? "" :
    r.ask === "missing" ? "Scrie și localitatea (UAT-ul), de exemplu „413830 Giroc”." :
    r.ask === "county" ? `„${r.options![0].name}” există în mai multe județe: scrie și județul (${r.options!.map((u) => u.county).join(" sau ")}).` :
    "Nu recunosc localitatea. Scrie UAT-ul așa cum apare în localizator, de exemplu „413830 Giroc, Timiș”.";

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (r.kind === "empty") return;
    if (r.kind === "address") { location.href = `/localizare?adr=${encodeURIComponent(r.q)}`; return; }
    if (r.uat) location.href = `/localizare?uat=${encodeURIComponent(r.uat.key)}&q=${encodeURIComponent(r.nr)}`;
  };

  return (
    <form className="quickMain" onSubmit={go} noValidate>
      <label className="quickLbl" htmlFor="quickQ">Caută un imobil</label>
      <div className="quickRow">
        <input id="quickQ" className="quickInput" name="q" value={text} onChange={(e) => { setText(e.target.value); setTried(false); }}
          placeholder="Nr. cadastral și localitatea (413830 Giroc), adresă sau coordonate" autoComplete="off" />
        <button type="submit" className="quickBtn">Caută</button>
      </div>
      {r.kind === "number" && r.uat && <p className="quickHint">Nr. <b>{r.nr}</b> în <b>{r.uat.name}</b>, județul {r.uat.county}</p>}
      {r.kind === "address" && <p className="quickHint">Caut adresa sau coordonatele pe hartă</p>}
      {msg && (tried || r.ask === "county") && <p className="quickMsg" role="alert">{msg}</p>}
      {r.kind === "empty" && tried && <p className="quickMsg" role="alert">Scrie un număr cadastral cu localitatea, o adresă sau coordonate.</p>}
    </form>
  );
}
