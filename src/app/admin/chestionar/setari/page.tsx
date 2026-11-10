import type { Metadata } from "next";
import { superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { SurveyAdmin } from "@/components/SurveyAdmin";
import { SurveyNav } from "@/components/SurveyNav";
import { surveySettings } from "@/lib/survey";

export const metadata: Metadata = { title: "Chestionar · setări | UVALO Admin" };
export const dynamic = "force-dynamic";

/** Admin → Chestionar → Setări: on / off, the threshold, the stop rules, the options of step 3, „Chestionar nou”. */
export default async function SurveySettingsPage() {
  const { db, c, pending } = await superPage();
  const s = await surveySettings(db);
  const { results: older } = await db.prepare("SELECT survey_id AS id, COUNT(*) AS n, SUM(done_at IS NOT NULL) AS d FROM survey_answers GROUP BY survey_id ORDER BY MAX(created_at) DESC").all<{ id: string; n: number; d: number }>();
  const eligible = (await db.prepare("SELECT COUNT(*) AS n FROM (SELECT user_id FROM events e JOIN users u ON u.id = e.user_id AND u.status = 'active' AND u.is_superadmin = 0 GROUP BY user_id HAVING COUNT(*) >= ?)").bind(s.min_actions).first<{ n: number }>())?.n ?? 0;
  return (
    <AdminShell c={c} active="chestionar" pending={pending} title="Chestionarul de feedback" subtitle={`${s.id} · ${s.on ? "se afișează" : "oprit"} · ${eligible} conturi eligibile acum`}>
      <SurveyNav page="settings" id={s.id} activeId={s.id} older={older} />
      <section className="card"><h2 style={{ margin: 0, fontSize: 16 }}>Chestionarul activ <span className={`pill ${s.on ? "pillOk" : ""}`} style={{ marginLeft: 8 }}><i />{s.on ? "se afișează" : "oprit"}</span></h2><SurveyAdmin s={s} /></section>
      <section className="card" style={{ gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Cum funcționează</h2>
        <p className="hint" style={{ margin: 0 }}>Chestionarul apare o singură dată, obligatoriu, la următoarea deschidere a platformei (web sau telefon), celor cu cel puțin pragul de acțiuni de mai sus. Nu îl primesc super-adminii, cei adăugați în firme ca evaluatori în birou / operaționali și asociații (angajați / colaboratori). Fiecare pas se salvează la „Continuă”, deci persoana revine unde a rămas. La completare, super-adminii primesc un email cu toate răspunsurile.</p>
      </section>
    </AdminShell>
  );
}
