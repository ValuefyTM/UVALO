import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { now, uuid } from "@/lib/db";
import { normEmail, randomCode, safeEqual, sha256, validEmail } from "@/lib/crypto";
import { findUser, audit } from "@/lib/auth";
import { layout, sendEmail } from "@/lib/email";

/** Step 1 of changing the sign-in email: a code goes to the new address. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const email = normEmail(str((await json(req)).email, 160));
  if (!validEmail(email)) return err("Adresa de email nu pare validă.");
  if (email === a.c.user.email) return err("Aceasta este deja adresa contului.");
  const taken = await findUser(a.db, email);
  if (taken) return err("Adresa este folosită de alt cont.");
  const recent = await a.db.prepare("SELECT COUNT(*) AS n FROM email_changes WHERE user_id = ? AND created_at > ?").bind(a.c.user.id, new Date(Date.now() - 3600_000).toISOString()).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return err("Prea multe încercări. Reîncearcă peste o oră.");
  const code = randomCode();
  await a.db.prepare("INSERT INTO email_changes (id, user_id, new_email, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(uuid(), a.c.user.id, email, await sha256(`${email}:${code}`), new Date(Date.now() + 15 * 60_000).toISOString()).run();
  await sendEmail({
    to: email,
    subject: `Confirmă noua adresă VALUEFY Tools: ${code}`,
    text: `Codul pentru confirmarea noii adrese a contului VALUEFY Tools este ${code}. Este valabil 15 minute.`,
    html: layout({
      eyebrow: "VALUEFY Tools", title: "Confirmă noua adresă de email",
      body: `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#4A4A4A">Introdu codul în pagina „Contul meu”:</p><p style="margin:16px 0;font-size:34px;font-weight:bold;letter-spacing:8px;font-family:ui-monospace,Menlo,monospace">${code}</p>`,
      foot: "Codul este valabil 15 minute. Dacă nu ai cerut tu schimbarea, ignoră acest email.",
    }),
  });
  return NextResponse.json({ ok: true });
}

/** Step 2: the code from the new address → the account's email is changed. */
export async function PUT(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const code = str((await json(req)).code, 12).replace(/\D/g, "");
  const row = await a.db.prepare("SELECT id, new_email, code_hash, attempts FROM email_changes WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1")
    .bind(a.c.user.id, now()).first<{ id: string; new_email: string; code_hash: string; attempts: number }>();
  if (!row || row.attempts >= 5) return err("Codul a expirat. Cere unul nou.");
  if (!safeEqual(row.code_hash, await sha256(`${row.new_email}:${code}`))) {
    await a.db.prepare("UPDATE email_changes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    return err("Codul nu este corect.");
  }
  if (await findUser(a.db, row.new_email)) return err("Adresa este folosită de alt cont.");
  await a.db.batch([
    a.db.prepare("UPDATE email_changes SET used_at = ? WHERE id = ?").bind(now(), row.id),
    a.db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(row.new_email, a.c.user.id),
  ]);
  await audit(a.db, a.c.user.id, "user.email", "user", a.c.user.id, `${a.c.user.email} → ${row.new_email}`);
  return NextResponse.json({ ok: true, email: row.new_email });
}
