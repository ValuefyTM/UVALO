import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { esc, layout, sendEmail } from "@/lib/email";
import { origin } from "@/lib/site";

const KINDS: Record<string, string> = { problema: "Problemă", idee: "Idee", altceva: "Altceva" };

/** Feedback from the floating button: saved for Admin → Feedback; the UVALO administrators get an email. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  const text = typeof b.text === "string" ? b.text.replace(/\r\n/g, "\n").trim().slice(0, 2000) : "";
  if (text.length < 3) return err("Scrie câteva cuvinte.");
  const kind = typeof b.kind === "string" && b.kind in KINDS ? b.kind : "altceva";
  const page = typeof b.page === "string" ? b.page.slice(0, 300) : null;
  const recent = await a.db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(a.c.user.id).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) return err("Ai trimis multe mesaje în ultima oră. Încearcă puțin mai târziu.", 429);
  const r = await a.db.prepare("INSERT INTO feedback (user_id, org_id, kind, text, page, ua, contact) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(a.c.user.id, a.c.org?.id ?? null, kind, text, page, (req.headers.get("user-agent") ?? "").slice(0, 300), b.contact === false ? 0 : 1).run();

  const who = a.c.user.name || a.c.user.email, base = await origin();
  const { results: admins } = await a.db.prepare("SELECT email FROM users WHERE is_superadmin = 1 AND status = 'active'").all<{ email: string }>();
  for (const x of admins) {
    await sendEmail({
      to: x.email,
      subject: `Feedback (${KINDS[kind]}) de la ${who}`,
      text: `${who} (${a.c.user.email}) a trimis feedback, ${KINDS[kind]}, din ${page ?? "—"}:\n\n${text}\n\nToate mesajele: ${base}/admin/feedback`,
      html: layout({
        eyebrow: "UVALO · Feedback", title: `${KINDS[kind]} de la ${who}`,
        body: `<p style="margin:0 0 10px;font-size:13px;color:#6B6B6B">${esc(a.c.user.email)}${a.c.org ? ` · ${esc(a.c.org.name)}` : ""} · ${esc(page ?? "")}</p><p style="margin:0;font-size:15px;line-height:1.65;color:#141414;white-space:pre-wrap">${esc(text)}</p>`,
        button: { label: "Vezi tot feedback-ul →", url: `${base}/admin/feedback` },
        foot: "Primești acest email ca administrator UVALO.",
      }),
    }).catch(() => false);
  }
  return NextResponse.json({ ok: true, id: r.meta.last_row_id });
}
