import { api } from "@/lib/api";
import { tablou, type TablouFilter } from "@/lib/tablou";

/** The filtered ANEVAR list as CSV (Excel, ;-separated, UTF-8 with BOM). */
export async function GET(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const f = Object.fromEntries(new URL(req.url).searchParams) as TablouFilter;
  const { rows } = await tablou(a.db, f, true);
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Legitimatie", "Nume", "Judet", "Specializari", "Cont", "Email", "Ultima autentificare", "Ultima activitate", "Actiuni 30 zile", "In tabloul curent"].join(";")];
  for (const r of rows) lines.push([r.legit, r.name, r.county, r.specs, r.user_status ?? (r.request === "pending" ? "solicitare" : ""), r.email, r.last_login_at, r.last_seen_at, r.user_id ? r.events_30 : "", r.in_current ? "da" : "nu"].map(q).join(";"));
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tablou-anevar-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
