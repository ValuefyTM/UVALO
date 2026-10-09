// Server-only: email through Resend. Returns false (never throws) when it cannot send.
// RESEND_API_KEY + EMAIL_FROM (e.g. "UVALO <tools@valuefy.ro>", the domain must be verified in Resend).
// Local and test environments (APP_ENV local / staging) keep every email in dev_mail, shown at /dev/mail; in staging
// only the addresses in MAIL_ALLOW ("ana@valuefy.ro,@valuefy.ro") also receive it for real.
import { appEnv } from "./config";
import { getDb } from "./db";

const allowed = (to: string) => {
  const list = (process.env.MAIL_ALLOW ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const t = to.trim().toLowerCase();
  return list.some((a) => (a.startsWith("@") ? t.endsWith(a) : t === a));
};

export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const env = appEnv();
  const real = env === "production" || (env === "staging" && allowed(opts.to));
  if (env !== "production") {
    const db = await getDb();
    await db?.prepare("INSERT INTO dev_mail (to_addr, subject, html, text, sent, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(opts.to, opts.subject, opts.html, opts.text, real ? 1 : 0, new Date().toISOString()).run().catch((e) => console.error("[email] dev_mail", e));
    console.log(`[email] ${real ? "sent + kept" : "kept"} for ${opts.to}: ${opts.subject} → /dev/mail`);
    if (!real) return true;
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.TOOLS_EMAIL_FROM || process.env.CRM_EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn(`[email] not configured — would send to ${opts.to}: ${opts.subject}\n${opts.text}`);
    return env !== "production";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: env === "staging" ? `[TEST] ${opts.subject}` : opts.subject, html: opts.html, text: opts.text }),
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
