// Server-only: email through Resend. Returns false (never throws) when it cannot send.
// RESEND_API_KEY + TOOLS_EMAIL_FROM (e.g. "UVALO <cont@uvalo.ro>", the domain must be verified in Resend).
// Local and test environments (APP_ENV local / staging) keep every email in dev_mail, shown at /dev/mail; in staging
// only the addresses in MAIL_ALLOW ("ana@uvalo.ro,@uvalo.ro") also receive it for real, with "[TEST]" in the subject.
import { appEnv } from "./config";
import { getDb } from "./db";

type Mail = { to: string; subject: string; html: string; text: string };

const allowed = (to: string) => {
  const list = (process.env.MAIL_ALLOW ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const t = to.trim().toLowerCase();
  return list.some((a) => (a.startsWith("@") ? t.endsWith(a) : t === a));
};

/** Outside production: the email is kept in dev_mail; true = it also goes out for real (staging, address in MAIL_ALLOW). */
async function keep(list: Mail[]): Promise<Mail[]> {
  const env = appEnv();
  if (env === "production") return list;
  const real = list.filter((m) => env === "staging" && allowed(m.to));
  const db = await getDb();
  if (db) {
    const at = new Date().toISOString();
    await db.batch(list.map((m) => db.prepare("INSERT INTO dev_mail (to_addr, subject, html, text, sent, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(m.to, m.subject, m.html, m.text, real.includes(m) ? 1 : 0, at))).catch((e) => console.error("[email] dev_mail", e));
  }
  console.log(`[email] kept ${list.length} for /dev/mail, ${real.length} also sent (${env})`);
  return real.map((m) => ({ ...m, subject: `[TEST] ${m.subject}` }));
}

export async function sendEmail(opts: Mail): Promise<boolean> {
  const env = appEnv();
  const [mail] = await keep([opts]);
  if (!mail) return true; // kept for /dev/mail only
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TOOLS_EMAIL_FROM || process.env.CRM_EMAIL_FROM;
  if (!apiKey || !from) {
    // Local development without email: show the message in the server log instead.
    console.warn(`[email] not configured — would send to ${opts.to}: ${opts.subject}\n${opts.text}`);
    return env !== "production";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) {
      console.error("[email] failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] failed", error);
    return false;
  }
}

/** Many separate emails at once (Resend batch API, 100 per call). Returns how many were accepted. */
export async function sendEmails(all: Mail[]): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TOOLS_EMAIL_FROM || process.env.CRM_EMAIL_FROM;
  if (!all.length) return 0;
  const list = await keep(all);
  if (!list.length) return all.length; // kept for /dev/mail only
  if (!apiKey || !from) {
    console.warn(`[email] not configured — would send ${list.length} emails: ${list[0].subject}\n${list[0].text}`);
    return 0;
  }
  let sent = 0;
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(part.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }))),
      });
      if (res.ok) sent += part.length;
      else console.error("[email] batch failed", res.status, await res.text());
    } catch (error) {
      console.error("[email] batch failed", error);
    }
  }
  return sent;
}

/** A name for a greeting: "IONESCU MARIA-ELENA" (as in the ANEVAR list) → "Ionescu Maria-Elena"; mixed case is left as typed. */
export function greetName(name: string | null | undefined) {
  const n = (name ?? "").trim().replace(/\s+/g, " ");
  if (!n || n !== n.toLocaleUpperCase("ro")) return n;
  return n.toLocaleLowerCase("ro").replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase("ro"));
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Simple branded layout shared by every email. */
export function layout(opts: { eyebrow: string; title: string; body: string; button?: { label: string; url: string }; foot: string }) {
  const btn = opts.button
    ? `<p style="margin:24px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#F2A93B;color:#111111;font-weight:bold;text-decoration:none;padding:14px 22px;border-radius:12px">${esc(opts.button.label)}</a></p>`
    : "";
  return `<!DOCTYPE html><html lang="ro"><body style="margin:0;padding:0;background:#F2ECE0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2ECE0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Verdana,Geneva,sans-serif;color:#111111">
<tr><td style="background:#111111;padding:20px 28px;color:#F5BE66;font-size:12px;font-weight:bold;letter-spacing:2px">UVALO</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#9A5F00;text-transform:uppercase">${esc(opts.eyebrow)}</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3">${esc(opts.title)}</h1>
${opts.body}${btn}
</td></tr>
<tr><td style="background:#FBF8F2;padding:16px 28px;font-size:12px;line-height:1.6;color:#6B6B6B">${opts.foot}</td></tr>
</table></td></tr></table></body></html>`;
}
