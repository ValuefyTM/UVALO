import { fail, keyApi, putInspection } from "@/lib/integration";

/**
 * Sends an inspection to a valuer (by ANEVAR card), or updates the one with the same `ref` while it is not finished:
 * `{ ref, legit, address, cad_nr?, cf_nr?, county?, uat?, lat?, lng?, prop_type?, area_util?, area_land?, rooms?: [{n, a}],
 *    contact_name?, contact_phone?, contact_role?, instructions?, due_on?, template_ref? | template_id?,
 *    client? (clientul lucrării), report_user? (utilizatorul raportului, ex. banca) }`.
 */
export async function POST(req: Request) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = await putInspection(a.db, a.key, b);
  return "error" in r ? fail(r.error, r.status ?? 400) : Response.json(r, { status: r.created ? 201 : 200 });
}
