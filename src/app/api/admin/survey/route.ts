import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { setSurveySettings, surveyCsv, surveyRows, surveySettings } from "@/lib/survey";

/** Admin → Feedback → Chestionar: `?csv=1` downloads every answer of the active questionnaire. */
export async function GET(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const s = await surveySettings(a.db);
  const id = new URL(req.url).searchParams.get("id") || s.id;
  if (!new URL(req.url).searchParams.get("csv")) return NextResponse.json({ settings: s });
  const rows = await surveyRows(a.db, id);
  return new Response(surveyCsv(rows, s.wants), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="chestionar-${id}.csv"` } });
}

/** {action: "settings", on, min_actions, stop_n, stop_at, wants[]} or {action: "new"} (a new id: everyone eligible gets it again). */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const s = await surveySettings(a.db);
  if (b.action === "new") {
    const d = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
    let id = d.slice(0, 7);
    if (id === s.id || (await a.db.prepare("SELECT 1 FROM survey_answers WHERE survey_id = ? LIMIT 1").bind(id).first())) id = d;
    if (id === s.id) id = `${d}-${Date.now().toString(36).slice(-3)}`;
    await setSurveySettings(a.db, a.c.user.id, { ...s, id, on: true, started_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, id });
  }
  if (b.action !== "settings") return err("Acțiune necunoscută.");
  const wants = Array.isArray(b.wants) ? b.wants.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, 12) : s.wants;
  const on = typeof b.on === "boolean" ? b.on : s.on;
  await setSurveySettings(a.db, a.c.user.id, {
    ...s, on, wants: wants.length ? wants : s.wants,
    min_actions: Number.isFinite(Number(b.min_actions)) ? Math.max(0, Math.floor(Number(b.min_actions))) : s.min_actions,
    stop_n: Number.isFinite(Number(b.stop_n)) ? Math.max(0, Math.floor(Number(b.stop_n))) : s.stop_n,
    stop_at: typeof b.stop_at === "string" && /^(\d{4}-\d{2}-\d{2})?$/.test(b.stop_at) ? b.stop_at : s.stop_at,
    started_at: on && !s.on ? new Date().toISOString() : s.started_at,
  });
  return NextResponse.json({ ok: true });
}
