import { api } from "@/lib/api";
import { origin } from "@/lib/site";
import { myAssigned, phoneCollab, phoneFirms, phoneInfo, phoneNotifs, usableTemplates } from "@/lib/insp";

/** Phone app: who is signed in (profile, activity, this phone), the inspections they have to do, the sheets for a new one. */
export async function GET() {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  const allowed = c.modules.includes("inspectii");
  const u = c.user, o = c.org;
  const [items, info, tpls, notifs, collab, firms] = allowed
    ? await Promise.all([myAssigned(db, u.id), phoneInfo(db, u.id, c.session.id), usableTemplates(db, c), phoneNotifs(db, u.id), phoneCollab(db, u.id), phoneFirms(db, u.id)])
    : [[], null, [], [], [], []];
  // whether the account has a signature (the image itself is read on demand, GET /api/account/signature)
  const sig = await db.prepare("SELECT signature IS NOT NULL AS s FROM users WHERE id = ?").bind(u.id).first<{ s: number }>();
  return Response.json({
    user: {
      id: u.id, name: u.name || u.email, email: u.email, avatar: !!u.has_avatar, anevar_no: u.anevar_no, county: u.county, phone: u.phone, has_sig: !!sig?.s,
      org: o && (o.office_at || c.orgs.length > 1) ? { id: o.id, name: o.name, logo: !!o.has_logo, role: c.role } : null,
    },
    allowed, items, info, notifs, collab, firms,
    // Colaborări in the phone tab (same module and mode as on the web) and the web address for what stays on the web (profile, zones)
    collabOn: c.modules.includes("colaborari"), app: await origin(),
    templates: tpls.map((t) => ({ id: t.id, name: t.name, prop_type: t.prop_type })),
  }, { headers: { "Cache-Control": "no-store" } });
}
