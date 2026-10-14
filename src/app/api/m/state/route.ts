import { api } from "@/lib/api";
import { myAssigned } from "@/lib/insp";

/** Phone app: who is signed in and the inspections they have to do (assigned to them). */
export async function GET() {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  const allowed = c.modules.includes("inspectii");
  return Response.json({
    user: { id: c.user.id, name: c.user.name || c.user.email, email: c.user.email, avatar: !!c.user.has_avatar },
    allowed, items: allowed ? await myAssigned(db, c.user.id) : [],
  }, { headers: { "Cache-Control": "no-store" } });
}
