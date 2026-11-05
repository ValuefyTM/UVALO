// The launch email of the Inspecții module ("Gata cu hârtiile la inspecție"), sent once from Admin → Instrumente → Inspecții, after
// the canvas "UVALO — Email lansare Inspecții": a sign-in link straight to /inspectii (7 days), the banner from the site, the three
// steps, what the module does, how to install the phone app.
import { magicLink } from "./auth";
import { esc, greetName, sendEmails } from "./email";
import { origin } from "./site";

export type LaunchRow = { id: string; email: string; name: string; sup: number; newsletter: number; access: number; mailed: string | null; allowed: boolean };

/** Everyone the launch email could go to: active accounts, with whether they have access (an active firm with a valid subscription). */
export async function inspLaunchList(db: D1Database): Promise<LaunchRow[]> {
  const { results } = await db.prepare(`SELECT u.id, u.email, u.name, u.is_superadmin AS sup, COALESCE(u.newsletter, 0) AS newsletter,
      EXISTS (SELECT 1 FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' AND o.status = 'active'
        AND (o.valid_until IS NULL OR o.valid_until >= date('now'))) AS access,
      (SELECT MAX(x.at) FROM events x WHERE x.user_id = u.id AND x.module = 'inspectii' AND x.action = 'launch_mail') AS mailed
    FROM users u WHERE u.status = 'active' AND u.is_superadmin = 0 ORDER BY u.name COLLATE NOCASE`)
    .all<Omit<LaunchRow, "allowed">>();
  return results.map((r) => ({ ...r, allowed: !!r.access }));
}

/** Sends the launch email to those allowed and not mailed yet: with `all`, also to those who did not tick the newsletter. */
export async function sendInspLaunchEmails(db: D1Database, all = false) {
  const list = (await inspLaunchList(db)).filter((r) => r.allowed && !r.mailed && (all || r.newsletter));
  if (!list.length) return { sent: 0 };
  const base = await origin();
  const mails = [];
  for (const u of list) {
    const link = await magicLink(db, u.email, "/inspectii", 7);
    const hi = u.name?.trim() ? `Bună ziua, ${greetName(u.name)}!` : "Bună ziua!";
    mails.push({
      to: u.email,
      subject: "Inspecțiile au ajuns în UVALO: fișa, pozele și semnătura, pe telefon",
      text: `${hi}\nModulul Inspecții este de astăzi disponibil în contul tău UVALO. Pregătești inspecția pe web în două minute, o faci pe teren din aplicația de telefon, iar fișa apare gata în platformă, cu fotografii, locația GPS și semnătura persoanei prezente. Merge și fără semnal.\n\nCum funcționează:\n1. Pregătești pe web: adresa, nr. cadastral, fișa potrivită, contactul și ora. Extrasul CF se citește singur.\n2. Faci pe telefon: răspunzi pe secțiuni, fotografiezi pe categorii, iei GPS-ul și semnătura.\n3. Fișa e gata pe web: cu număr și dată, PDF, link pentru client și pozele inserate în raport din Word.\n\nInstalezi aplicația din cont: Inspecții → Setări → Conectează telefonul (scanezi codul QR). Pașii: ${base}/site/inspectii\n\nDeschide Inspecțiile: ${link}\n(Linkul te autentifică direct și este valabil 7 zile.)\n\nIdei sau probleme: Suport tehnic, în platformă. Spor la inspecții!\nEchipa UVALO`,
      html: launchHtml({ hi, link, base }),
    });
  }
  const sent = await sendEmails(mails);
  if (sent) await db.batch(list.slice(0, sent).map((u) => db.prepare("INSERT INTO events (user_id, module, action) VALUES (?, 'inspectii', 'launch_mail')").bind(u.id)));
  return { sent };
}

function launchHtml({ hi, link, base }: { hi: string; link: string; base: string }) {
  const step = (n: string, t: string, d: string) => `<td width="33%" style="padding:0 6px;vertical-align:top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F2;border-radius:12px"><tr><td style="padding:14px">
<div style="width:28px;height:28px;border-radius:14px;background:#141414;color:#F5BE66;font-size:13px;font-weight:bold;text-align:center;line-height:28px">${n}</div>
<p style="margin:8px 0 4px;font-size:13px;font-weight:bold;color:#141414">${esc(t)}</p><p style="margin:0;font-size:12px;line-height:1.5;color:#4A4A4A">${esc(d)}</p></td></tr></table></td>`;
  const feat = (t: string, d: string) => `<tr><td style="padding:0 0 12px;vertical-align:top;width:34px"><div style="width:24px;height:24px;border-radius:12px;background:#FDF1DC;color:#9A5F00;font-size:13px;font-weight:bold;text-align:center;line-height:24px">✓</div></td>
<td style="padding:0 0 12px;font-size:13px;line-height:1.55;color:#4A4A4A"><b style="color:#141414">${esc(t)}</b><br>${esc(d)}</td></tr>`;
  return `<!DOCTYPE html><html lang="ro"><body style="margin:0;padding:0;background:#F2ECE0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2ECE0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Verdana,Geneva,sans-serif;color:#111111">
<tr><td style="background:#111111;padding:18px 28px"><span style="color:#fff;font-size:15px;font-weight:bold;letter-spacing:2px">UVA<span style="color:#E0AD4F">LO</span></span>
<span style="float:right;color:#F5BE66;font-size:11px;font-weight:bold;letter-spacing:2px;line-height:20px">NOU ÎN UVALO</span></td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 10px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#9A5F00;text-transform:uppercase">Inspecții · lansare</p>
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111111">Gata cu hârtiile la inspecție. Fișa, pozele și semnătura, pe telefon.</h1>
<p style="margin:0 0 10px;font-size:15px;line-height:1.65">${esc(hi)}</p>
<p style="margin:0;font-size:15px;line-height:1.65">Modulul <b>Inspecții</b> este de astăzi disponibil în contul tău UVALO. Pregătești inspecția pe web în două minute, o faci pe teren din aplicația de telefon, iar fișa apare gata în platformă, cu fotografii, locația GPS și semnătura persoanei prezente.</p>
</td></tr>
<tr><td style="padding:16px 28px 8px"><a href="${esc(link)}"><img src="${esc(base)}/site/inspectii-banner.png" width="544" alt="Inspecțiile UVALO pe web și pe telefon" style="display:block;width:100%;height:auto;border:1px solid #E8E0D0;border-radius:12px"></a></td></tr>
<tr><td style="padding:12px 28px 24px">
<a href="${esc(link)}" style="display:inline-block;background:#F2A93B;color:#111111;font-weight:bold;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:15px">Deschide Inspecțiile →</a>
<p style="margin:8px 0 0;font-size:12px;color:#6B6B6B">Butonul te duce direct în cont, fără cod de autentificare, timp de 7 zile.</p>
</td></tr>
<tr><td style="padding:0 28px"><div style="height:1px;background:#EFE9DC"></div></td></tr>
<tr><td style="padding:24px 22px 12px">
<p style="margin:0 6px 14px;font-size:17px;font-weight:bold">Cum funcționează</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${step("1", "Pregătești pe web", "Adresa, nr. cadastral, fișa potrivită, contactul și ora. Extrasul CF se citește singur.")}
${step("2", "Faci pe telefon", "Răspunzi pe secțiuni, fotografiezi pe categorii, iei GPS-ul și semnătura. Merge și fără semnal.")}
${step("3", "Fișa e gata pe web", "Cu număr și dată, PDF, link pentru client și pozele inserate în raport din Word.")}
</tr></table></td></tr>
<tr><td style="padding:0 28px"><div style="height:1px;background:#EFE9DC"></div></td></tr>
<tr><td style="padding:24px 28px 8px">
<p style="margin:0 0 14px;font-size:17px;font-weight:bold">Ce găsești în modul</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${feat("Fișe pe tipuri de imobil", "Apartament, casă, teren, spațiu comercial, accesoriu. Sau fișele tale, în editorul propriu.")}
${feat("Fotografii pe categorii", "Exterior, încăperi, acte. Direct din aplicație sau din galerie, cu ora și locul.")}
${feat("Locația GPS și semnătura", "Locul inspecției pe hartă, semnătura persoanei prezente pe ecran, a ta aplicată automat.")}
${feat("Merge fără semnal", "Răspunsurile și pozele se păstrează pe telefon și se trimit singure când revine rețeaua.")}
${feat("PDF, link public, Word", "Fișa ca document, un link pentru client cu brandingul firmei tale, pozele în raport prin UVALO pentru Word.")}
${feat("Pentru birouri", "Aloci inspecțiile colegilor sau colaboratorilor și vezi pe web tot ce se întâmplă pe teren.")}
</table></td></tr>
<tr><td style="padding:8px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:14px"><tr><td style="padding:20px 22px;color:#D6D6D6;font-size:12.5px;line-height:1.55">
<p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#F5BE66">Instalează aplicația pe telefon</p>
<p style="margin:0 0 6px">Din cont: <b style="color:#FFFFFF">Inspecții → Setări → Conectează telefonul</b>. Scanezi codul QR cu camera telefonului și aplicația se deschide deja conectată.</p>
<p style="margin:0 0 8px">Pe iPhone: Partajează → „Adaugă pe ecranul principal”. Pe Android: butonul „Instalează”.</p>
<a href="${esc(base)}/site/inspectii" style="color:#F5BE66;font-weight:bold;text-decoration:none">Vezi pașii de instalare și ce face aplicația →</a>
</td></tr></table></td></tr>
<tr><td style="padding:24px 28px 8px;font-size:14px;line-height:1.65">
<p style="margin:0 0 10px">Modulul e inclus în contul tău, fără cost suplimentar în această perioadă. Dacă ceva nu merge sau ai o idee, scrie-ne din <a href="${esc(base)}/suport" style="color:#9A5F00">Suport tehnic</a>: răspundem în chat.</p>
<p style="margin:0">Spor la inspecții,<br><b>Echipa UVALO</b></p>
</td></tr>
<tr><td style="padding:16px 28px 24px"><a href="${esc(link)}" style="display:inline-block;background:#111111;color:#FFFFFF;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:14px">Pregătește prima inspecție →</a></td></tr>
<tr><td style="background:#FBF8F2;padding:16px 28px;font-size:11.5px;line-height:1.6;color:#6B6B6B">Primești acest email pentru că ai cont în UVALO. Poți opri noutățile din <a href="${esc(base)}/cont" style="color:#9A5F00">Contul meu</a>.<br>UVALO · app.uvalo.ro · office@uvalo.ro · IDEONA ANALYTICS S.R.L., Str. Circumvalațiunii nr. 33, Timișoara</td></tr>
</table></td></tr></table></body></html>`;
}
