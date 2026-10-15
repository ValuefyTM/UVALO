import { getDb } from "@/lib/db";
import { notifyUser, once } from "@/lib/webpush";

// Called every 15 minutes by the worker's schedule (worker.ts → scheduled), with the key it keeps in app_settings ("cron_key").
// Sends the phone reminders: an hour before each scheduled inspection, and in the morning the day's inspections.

/** "Now" in Romania, as the inspections store their time ("2026-10-16T10:00"). */
function local(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return new Response(null, { status: 503 });
  const key = await db.prepare("SELECT value FROM app_settings WHERE key = 'cron_key'").first<{ value: string }>();
  if (!key || req.headers.get("x-cron-key") !== JSON.parse(key.value)) return new Response(null, { status: 403 });
  const nowL = local(), from = local(new Date(Date.now() + 45 * 60e3)), to = local(new Date(Date.now() + 75 * 60e3));
  let sent = 0;

  // an hour before
  const { results: soon } = await db.prepare(`SELECT i.id, i.address, i.scheduled_at, i.assignee_id FROM inspections i
    WHERE i.status = 'plan' AND i.deleted_at IS NULL AND i.assignee_id IN (SELECT user_id FROM insp_push) AND i.scheduled_at >= ? AND i.scheduled_at < ?`)
    .bind(from, to).all<{ id: string; address: string; scheduled_at: string; assignee_id: string }>();
  for (const i of soon) {
    if (!(await once(db, `soon:${i.id}:${i.scheduled_at}`))) continue;
    sent += await notifyUser(db, i.assignee_id, { title: `Peste o oră, la ${i.scheduled_at.slice(11, 16)}`, body: i.address, url: `/?open=${i.id}`, tag: `insp-${i.id}` });
  }

  // the morning summary, between 7:00 and 7:15
  const today = nowL.slice(0, 10);
  if (nowL.slice(11) >= "07:00" && nowL.slice(11) < "07:15") {
    const { results: day } = await db.prepare(`SELECT i.assignee_id AS uid, COUNT(*) AS n, MIN(i.scheduled_at) AS first,
      (SELECT address FROM inspections j WHERE j.assignee_id = i.assignee_id AND j.status = 'plan' AND j.deleted_at IS NULL AND substr(j.scheduled_at, 1, 10) = ?1 ORDER BY j.scheduled_at LIMIT 1) AS address
      FROM inspections i WHERE i.status = 'plan' AND i.deleted_at IS NULL AND substr(i.scheduled_at, 1, 10) = ?1 AND i.assignee_id IN (SELECT user_id FROM insp_push)
      GROUP BY i.assignee_id`).bind(today).all<{ uid: string; n: number; first: string; address: string }>();
    for (const d of day) {
      if (!(await once(db, `day:${d.uid}:${today}`))) continue;
      sent += await notifyUser(db, d.uid, { title: d.n === 1 ? "Azi ai o inspecție" : `Azi ai ${d.n} inspecții`, body: `Prima la ${d.first.slice(11, 16)}: ${d.address}`, url: "/", tag: `day-${today}` });
    }
  }
  await db.prepare("DELETE FROM insp_push_sent WHERE at < ?").bind(new Date(Date.now() - 30 * 864e5).toISOString()).run();
  return Response.json({ ok: true, sent });
}
