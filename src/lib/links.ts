// Server-only: "Birou de evaluare" → asocieri. Valuers with their own UVALO account linked to an office without taking a seat:
// angajat (employee) or colaborator (external). The office invites them (by email or ANEVAR card) or they ask from
// "Contul meu"; the other side accepts. Either can end it; the history stays (office_links, migration 0029).
import { now, uuid } from "./db";
import { audit } from "./auth";
import { esc, layout, sendEmail } from "./email";
import { origin } from "./site";
import { canManageOrg, type Ctx } from "./access";
import { admins } from "./office";

export type LinkKind = "angajat" | "colaborator";
export const LINK_KINDS: Record<LinkKind, string> = { angajat: "Angajat", colaborator: "Colaborator" };
const kindOf = (v: unknown): LinkKind => (v === "angajat" ? "angajat" : "colaborator");

type LinkRow = { id: string; org_id: string; user_id: string; kind: LinkKind; status: string; created_by: string | null; created_at: string; decided_at: string | null };

/** An office's links ("Firma mea"): active, invitations sent, requests received. */
export async function officeLinks(db: D1Database, orgId: string) {
  const { results } = await db.prepare(`SELECT l.id, l.kind, l.status, l.created_at, l.decided_at, u.id AS user_id, u.name, u.email, u.anevar_no, u.county, u.status AS user_status, u.avatar IS NOT NULL AS has_avatar
    FROM office_links l JOIN users u ON u.id = l.user_id WHERE l.org_id = ? AND l.status IN ('invited', 'requested', 'active')
    ORDER BY CASE l.status WHEN 'requested' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.name, u.email`).bind(orgId)
    .all<{ id: string; kind: LinkKind; status: string; created_at: string; decided_at: string | null; user_id: string; name: string | null; email: string; anevar_no: string | null; county: string | null; user_status: string; has_avatar: number }>();
  return results;
}

/** A valuer's links ("Contul meu"): active, invitations received, requests sent, and the ended ones (last 10). */
export async function myLinks(db: D1Database, userId: string) {
  const { results } = await db.prepare(`SELECT l.id, l.kind, l.status, l.created_at, l.decided_at, l.ended_at, o.id AS org_id, o.name AS org_name, o.corp_no,
      (o.logo IS NOT NULL) AS has_logo
    FROM office_links l JOIN orgs o ON o.id = l.org_id WHERE l.user_id = ? AND l.status IN ('invited', 'requested', 'active', 'ended')
    ORDER BY CASE l.status WHEN 'invited' THEN 0 WHEN 'active' THEN 1 WHEN 'requested' THEN 2 ELSE 3 END, COALESCE(l.ended_at, l.created_at) DESC LIMIT 40`).bind(userId)
    .all<{ id: string; kind: LinkKind; status: string; created_at: string; decided_at: string | null; ended_at: string | null; org_id: string; org_name: string; corp_no: string | null; has_logo: number }>();
  let ended = 0;
  return results.filter((r) => r.status !== "ended" || ++ended <= 10);
}

/** Offices a valuer can ask to join: active offices by name, without the ones the person is a member of. */
export async function searchOffices(db: D1Database, userId: string, q: string) {
  const t = q.trim().slice(0, 60);
  if (t.length < 2) return [];
  const { results } = await db.prepare(`SELECT o.id, o.name, o.corp_no, (o.logo IS NOT NULL) AS has_logo FROM orgs o
    WHERE o.office_at IS NOT NULL AND o.status = 'active' AND o.name LIKE ? ESCAPE '\\'
      AND o.id NOT IN (SELECT org_id FROM memberships WHERE user_id = ? AND status = 'active') ORDER BY o.name LIMIT 12`)
    .bind(`%${t.replace(/[\\%_]/g, (m) => `\\${m}`)}%`, userId).all<{ id: string; name: string; corp_no: string | null; has_logo: number }>();
  return results;
}

/** Office ids this person is linked with right now (for later: inspections, credits). */
export async function activeLinkOrgs(db: D1Database, userId: string) {
  return (await db.prepare("SELECT org_id, kind FROM office_links WHERE user_id = ? AND status = 'active'").bind(userId).all<{ org_id: string; kind: LinkKind }>()).results;
}

const P = (t: string) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A">${t}</p>`;
async function mail(to: string, subject: string, title: string, body: string, path: string, label: string) {
  const url = `${await origin()}${path}`;
  await sendEmail({
    to, subject, text: `${body.replace(/<[^>]+>/g, "")}\n${url}`,
    html: layout({ eyebrow: "Birou de evaluare", title, body, button: { label, url }, foot: "UVALO · platformă pentru evaluatori" }),
  });
}
const mailAdmins = async (db: D1Database, orgId: string, subject: string, title: string, body: string) => {
  for (const a of await admins(db, orgId)) await mail(a.email, subject, title, body, "/firma#asocieri", "Vezi în Firma mea →");
};

const isOfficeAdmin = (c: Ctx, orgId: string) => c.super || (c.org?.id === orgId && canManageOrg(c));
const who = (u: { name: string | null; email: string }) => u.name?.trim() || u.email;

/** Everything about links, one entry point: `{ action, ... }`. */
export async function linkAction(db: D1Database, c: Ctx, b: Record<string, unknown>): Promise<{ error: string } | { ok: true }> {
  const action = String(b.action ?? "");
  const t = now();

  if (action === "invite") {
    if (!c.org?.office_at || !isOfficeAdmin(c, c.org.id)) return { error: "Doar administratorii unui birou de evaluare pot asocia evaluatori." };
    const raw = typeof b.who === "string" ? b.who.trim() : "";
    const digits = raw.replace(/\D/g, "");
    const u = raw.includes("@")
      ? await db.prepare("SELECT id, name, email, anevar_no, status FROM users WHERE lower(email) = lower(?)").bind(raw).first<{ id: string; name: string | null; email: string; anevar_no: string | null; status: string }>()
      : digits ? await db.prepare("SELECT id, name, email, anevar_no, status FROM users WHERE anevar_no = ? AND status NOT IN ('disabled', 'closed')").bind(digits).first<{ id: string; name: string | null; email: string; anevar_no: string | null; status: string }>() : null;
    if (!raw) return { error: "Scrie emailul sau legitimația ANEVAR a evaluatorului." };
    if (!u || u.status === "disabled" || u.status === "closed") return { error: "Nu găsim un cont UVALO activ cu acest email sau legitimație. Asocierea e pentru evaluatorii care au deja cont; pe ceilalți îi poți invita ca membri." };
    if (!u.anevar_no) return { error: "Se pot asocia doar evaluatori (cu legitimație ANEVAR în cont). Colegii fără legitimație îi inviți ca membri, cu rol operațional." };
    if (u.id === c.user.id) return { error: "Nu te poți asocia cu propriul birou." };
    if (await db.prepare("SELECT 1 FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'").bind(c.org.id, u.id).first()) return { error: `${who(u)} este deja membru al biroului.` };
    const open = await db.prepare("SELECT status FROM office_links WHERE org_id = ? AND user_id = ? AND status IN ('invited', 'requested', 'active')").bind(c.org.id, u.id).first<{ status: string }>();
    if (open) return { error: open.status === "active" ? `${who(u)} este deja asociat.` : open.status === "invited" ? "Invitația a fost trimisă deja." : `${who(u)} a cerut deja asocierea: o aprobi mai jos.` };
    const kind = kindOf(b.kind);
    await db.prepare("INSERT INTO office_links (id, org_id, user_id, kind, status, created_by) VALUES (?, ?, ?, ?, 'invited', ?)").bind(uuid(), c.org.id, u.id, kind, c.user.id).run();
    await audit(db, c.user.id, "office.link_invite", "org", c.org.id, `${u.email} (${kind})`);
    await mail(u.email, `${c.org.name} vrea să te asocieze ca ${LINK_KINDS[kind].toLowerCase()}`, `Invitație de asociere de la ${c.org.name}`,
      P(`Biroul de evaluare <b>${esc(c.org.name)}</b> te invită să te asociezi ca <b>${LINK_KINDS[kind].toLowerCase()}</b>.`) +
      P("Contul tău UVALO rămâne al tău, neschimbat. Asocierea îi permite biroului să-ți atribuie inspecții. O poți încheia oricând."),
      "/cont#asocieri", "Vezi invitația →");
    return { ok: true };
  }

  if (action === "request") {
    if (!c.user.anevar_no) return { error: "Asocierea cu un birou este doar pentru evaluatori (cu legitimație ANEVAR în cont)." };
    const orgId = String(b.org_id ?? "");
    const org = await db.prepare("SELECT id, name FROM orgs WHERE id = ? AND office_at IS NOT NULL AND status = 'active'").bind(orgId).first<{ id: string; name: string }>();
    if (!org) return { error: "Biroul nu mai există." };
    if (await db.prepare("SELECT 1 FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'").bind(org.id, c.user.id).first()) return { error: "Faci deja parte din acest birou." };
    const open = await db.prepare("SELECT status FROM office_links WHERE org_id = ? AND user_id = ? AND status IN ('invited', 'requested', 'active')").bind(org.id, c.user.id).first<{ status: string }>();
    if (open) return { error: open.status === "active" ? "Ești deja asociat cu acest birou." : open.status === "requested" ? "Ai trimis deja cererea." : "Biroul te-a invitat deja: acceptă invitația mai sus." };
    const kind = kindOf(b.kind);
    await db.prepare("INSERT INTO office_links (id, org_id, user_id, kind, status, created_by) VALUES (?, ?, ?, ?, 'requested', ?)").bind(uuid(), org.id, c.user.id, kind, c.user.id).run();
    await audit(db, c.user.id, "office.link_request", "org", org.id, kind);
    const name = c.user.name?.trim() || c.user.email;
    await mailAdmins(db, org.id, `${name} vrea să se asocieze cu ${org.name}`, `Cerere de asociere: ${name}`,
      P(`<b>${esc(name)}</b> (legitimație ANEVAR ${esc(c.user.anevar_no)}) vrea să se asocieze cu biroul <b>${esc(org.name)}</b> ca <b>${LINK_KINDS[kind].toLowerCase()}</b>.`) +
      P("Asociații nu ocupă locuri în birou: își păstrează contul lor. Aprobi sau respingi cererea din „Firma mea”."));
    return { ok: true };
  }

  const id = String(b.id ?? "");
  const l = await db.prepare("SELECT * FROM office_links WHERE id = ?").bind(id).first<LinkRow>();
  if (!l) return { error: "Asocierea nu mai există." };
  const mine = l.user_id === c.user.id, adm = isOfficeAdmin(c, l.org_id);
  const [u, org] = await Promise.all([
    db.prepare("SELECT name, email FROM users WHERE id = ?").bind(l.user_id).first<{ name: string | null; email: string }>(),
    db.prepare("SELECT name FROM orgs WHERE id = ?").bind(l.org_id).first<{ name: string }>(),
  ]);
  if (!u || !org) return { error: "Asocierea nu mai există." };
  const set = (status: string, extra = "") => db.prepare(`UPDATE office_links SET status = ?, decided_by = ?, decided_at = ?${extra} WHERE id = ?`).bind(status, c.user.id, t, id).run();

  if (action === "accept" || action === "decline") {
    if (!mine || l.status !== "invited") return { error: "Invitația nu mai este în așteptare." };
    await set(action === "accept" ? "active" : "declined");
    await audit(db, c.user.id, `office.link_${action}`, "org", l.org_id, l.kind);
    if (action === "accept") await mailAdmins(db, l.org_id, `${who(u)} a acceptat asocierea`, `${who(u)} este acum asociat`,
      P(`<b>${esc(who(u))}</b> a acceptat asocierea cu biroul <b>${esc(org.name)}</b> ca <b>${LINK_KINDS[l.kind].toLowerCase()}</b>.`));
    return { ok: true };
  }
  if (action === "approve" || action === "reject") {
    if (!adm || l.status !== "requested") return { error: "Cererea nu mai este în așteptare." };
    await set(action === "approve" ? "active" : "declined");
    await audit(db, c.user.id, `office.link_${action}`, "org", l.org_id, u.email);
    if (action === "approve") await mail(u.email, `Ești asociat cu ${org.name}`, `Ești asociat cu ${org.name}`,
      P(`Biroul <b>${esc(org.name)}</b> a aprobat asocierea ta ca <b>${LINK_KINDS[l.kind].toLowerCase()}</b>. Contul tău UVALO rămâne al tău.`), "/cont#asocieri", "Vezi asocierile →");
    return { ok: true };
  }
  if (action === "cancel") {
    if (!((l.status === "invited" && adm) || (l.status === "requested" && mine))) return { error: "Nu mai este nimic de anulat." };
    await set("cancelled");
    await audit(db, c.user.id, "office.link_cancel", "org", l.org_id, u.email);
    return { ok: true };
  }
  if (action === "end") {
    if (l.status !== "active" || !(mine || adm)) return { error: "Asocierea nu este activă." };
    await db.prepare("UPDATE office_links SET status = 'ended', ended_by = ?, ended_at = ? WHERE id = ?").bind(c.user.id, t, id).run();
    await audit(db, c.user.id, "office.link_end", "org", l.org_id, u.email);
    if (mine) await mailAdmins(db, l.org_id, `${who(u)} a încheiat asocierea`, `${who(u)} a încheiat asocierea`,
      P(`<b>${esc(who(u))}</b> a încheiat asocierea cu biroul <b>${esc(org.name)}</b>. Inspecțiile făcute până acum rămân ale biroului.`));
    else await mail(u.email, `Asocierea cu ${org.name} s-a încheiat`, `Asocierea cu ${org.name} s-a încheiat`,
      P(`Biroul <b>${esc(org.name)}</b> a încheiat asocierea. Contul tău UVALO rămâne neschimbat.`), "/cont#asocieri", "Vezi asocierile →");
    return { ok: true };
  }
  if (action === "kind") {
    if (!adm || !["active", "invited"].includes(l.status)) return { error: "Doar administratorii biroului pot schimba tipul." };
    const kind = kindOf(b.kind);
    await db.prepare("UPDATE office_links SET kind = ? WHERE id = ?").bind(kind, id).run();
    await audit(db, c.user.id, "office.link_kind", "org", l.org_id, `${u.email} → ${kind}`);
    return { ok: true };
  }
  return { error: "Acțiune necunoscută." };
}
