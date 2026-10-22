import { api, err } from "@/lib/api";
import { track } from "@/lib/track";

/**
 * Phone app → Radar colegi (first phase: super-admins only). The colleagues' inspections scheduled on a day within a radius of the
 * phone: who does it (name, phone, card), when, the kind of property and the zone (the locality, never the exact address), the
 * position rounded to ~100 m (for the blip on the radar), plus my own scheduled inspections of that day (the distance between the
 * two inspections is computed on the phone).
 */
type Row = { id: string; address: string; prop_type: string | null; uat: string | null; scheduled_at: string; duration_min: number | null; lat: number; lng: number;
  assignee_id: string; name: string; email: string; phone: string | null; anevar_no: string | null; has_avatar: number; org_name: string | null };

const distM = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));
/** The locality out of an address written "Str. X nr. 5, Localitate" or "Localitate, str. X" (the part without a street or a number). */
function zoneOf(address: string, uat: string | null) {
  if (uat) return uat;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const loc = parts.find((p) => !/\d/.test(p) && !/^(str|strada|calea|bd|b-dul|bulevardul|aleea|piata|piața|intr|drum|sos|șos)/i.test(p));
  return loc ?? parts[parts.length - 1] ?? address;
}

export async function GET(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.super) return err("Radarul colegilor este deocamdată în testare, doar pentru administratori.", 403);
  if (!c.modules.includes("inspectii")) return err("Modulul Inspecții nu este disponibil.", 403);
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return err("Fără poziția telefonului.");
  const km = [5, 10, 25, 50].includes(Number(u.searchParams.get("km"))) ? Number(u.searchParams.get("km")) : 10;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("day") ?? "") ? u.searchParams.get("day")! : new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  // a bounding box first (cheap), the exact distance after
  const dLat = km / 111.32, dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const { results } = await db.prepare(`SELECT i.id, i.address, i.prop_type, i.uat, i.scheduled_at, i.duration_min, i.lat, i.lng, i.assignee_id,
      COALESCE(NULLIF(a.name, ''), a.email) AS name, a.email, a.phone, a.anevar_no, a.avatar IS NOT NULL AS has_avatar, og.name AS org_name
    FROM inspections i JOIN users a ON a.id = i.assignee_id LEFT JOIN orgs og ON og.id = i.org_id
    WHERE i.deleted_at IS NULL AND i.status IN ('plan', 'lucru') AND i.scheduled_at LIKE ? AND i.assignee_id <> ? AND a.status = 'active'
      AND i.lat BETWEEN ? AND ? AND i.lng BETWEEN ? AND ? ORDER BY i.scheduled_at LIMIT 300`)
    .bind(`${day}%`, c.user.id, lat - dLat, lat + dLat, lng - dLng, lng + dLng).all<Row>();
  const here: [number, number] = [lat, lng];
  const found = results.map((r) => ({ r, d: distM(here, [r.lat, r.lng]) })).filter((x) => x.d <= km * 1000).sort((x, y) => x.d - y.d)
    .map(({ r, d }) => ({
      id: r.id, user_id: r.assignee_id, name: r.name, email: r.email, phone: r.phone, legit: r.anevar_no, avatar: !!r.has_avatar, org: r.org_name,
      prop_type: r.prop_type, zone: zoneOf(r.address, r.uat), when: r.scheduled_at, duration_min: r.duration_min ?? 60,
      // ~100 m, enough for the blip on the radar, not the exact address
      lat: Math.round(r.lat * 1000) / 1000, lng: Math.round(r.lng * 1000) / 1000, dist_m: Math.round(d),
    }));
  // my own inspections of that day, with coordinates: the phone shows the distance between the two inspections
  const { results: mine } = await db.prepare(`SELECT id, address, scheduled_at, lat, lng FROM inspections WHERE deleted_at IS NULL AND assignee_id = ? AND status IN ('plan', 'lucru')
      AND scheduled_at LIKE ? AND lat IS NOT NULL AND lng IS NOT NULL ORDER BY scheduled_at LIMIT 20`).bind(c.user.id, `${day}%`).all<{ id: string; address: string; scheduled_at: string; lat: number; lng: number }>();
  await track(db, c, "inspectii", "radar", null, { km, day, n: found.length, test: 1 });
  return Response.json({ day, km, found, mine }, { headers: { "Cache-Control": "no-store" } });
}
