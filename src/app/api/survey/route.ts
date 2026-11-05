import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { saveSurvey, surveyFor } from "@/lib/survey";
import { track } from "@/lib/track";

/** The questionnaire for the signed-in person (null when there is none to answer). */
export async function GET() {
  const a = await api();
  if ("res" in a) return a.res;
  return NextResponse.json({ survey: await surveyFor(a.db, a.c) }, { headers: { "Cache-Control": "no-store" } });
}

/** One step: {step: 1–5, answers: {…}}; step 5 completes it. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  const r = await saveSurvey(a.db, a.c, Number(b.step), (b.answers && typeof b.answers === "object" ? b.answers : {}) as Record<string, unknown>);
  if ("error" in r) return err(r.error);
  await track(a.db, a.c, "home", r.done ? "survey_done" : "survey_step", null, { step: Number(b.step) });
  return NextResponse.json({ ok: true, done: r.done });
}
